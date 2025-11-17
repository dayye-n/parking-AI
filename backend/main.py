import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    PayloadSchemaType,
)

# ---------------------------------------------------------
# ENV + QDRANT CONFIG
# ---------------------------------------------------------

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

COLLECTION_NAME = "parking_zones"
VECTOR_SIZE = 5
DATA_PATH = Path(__file__).resolve().parent / "data" / "parking_zones.json"
GOOGLE_DISTANCE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"
GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
GOOGLE_PLACES_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

CITY_CENTROIDS: dict[str, Tuple[float, float]] = {
    "Dubai": (25.2048, 55.2708),
    "Abu Dhabi": (24.4539, 54.3773),
    "Sharjah": (25.3463, 55.4209),
}

MAX_TRAVEL_MINUTES = 45
MAX_PRICE_AED = 30
MAX_WALK_MINUTES = 15
PLACES_RADIUS_METERS = 3500
PRICE_LEVEL_TO_AED: Dict[int, float] = {
    0: 0.0,
    1: 4.0,
    2: 8.0,
    3: 15.0,
    4: 30.0,
}

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY or None)

SEED_ZONES: List["ParkingZone"] = []


# ---------------------------------------------------------
# MODELS
# ---------------------------------------------------------

class ParkingZone(BaseModel):
    id: int
    name: str
    city: str
    lat: float
    lng: float
    congestion_now: float          # 0–1 (1 = very congested)
    price_per_hour: float
    walking_time_minutes: float
    covered: bool
    ev_support: bool
    safety_score: float = 0.8
    amenities: Optional[List[str]] = None


class SuggestRequest(BaseModel):
    city: str
    results: int = 6
    prefer_covered: bool = True
    vehicle_type: str = "standard"      # "standard" | "ev"
    duration_hours: int = 1
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    origin_text: Optional[str] = None


class SuggestResult(BaseModel):
    id: int
    name: str
    city: str
    price_per_hour: float
    lat: float
    lng: float
    walking_time_minutes: float
    covered: bool
    ev_support: bool
    amenities: List[str]
    score: float
    open_spots: Optional[int] = None
    distance_meters: Optional[int] = None
    distance_text: Optional[str] = None
    duration_seconds: Optional[int] = None
    duration_text: Optional[str] = None
    travel_time_minutes: Optional[float] = None
    directions_url: Optional[str] = None
    duration_in_traffic_seconds: Optional[int] = None
    duration_in_traffic_text: Optional[str] = None
    congestion_score: Optional[float] = None
    confidence: Optional[int] = None
    recommendation_score: Optional[float] = None
    origin_source: Optional[str] = None
    request_origin_lat: Optional[float] = None
    request_origin_lng: Optional[float] = None


class GeocodeResponse(BaseModel):
    lat: float
    lng: float
    label: str


class Insight(BaseModel):
    title: str
    detail: str
    severity: str


class TimelineEvent(BaseModel):
    time: str
    title: str
    detail: str
    severity: str


class HealthStatus(BaseModel):
    label: str
    value: str
    severity: str


class DispatchEvent(BaseModel):
    message: str


# ---------------------------------------------------------
# VECTORS + FILTERS
# ---------------------------------------------------------

def normalize(v: float, min_v: float, max_v: float) -> float:
    if max_v == min_v:
        return 0.0
    return (v - min_v) / (max_v - min_v)


def build_vector(zone: ParkingZone) -> List[float]:
    """Turn one zone into a 5-dim vector for Qdrant."""
    return [
        zone.congestion_now,                          # want this low
        normalize(zone.price_per_hour, 0, 50),        # want this low
        normalize(zone.walking_time_minutes, 0, 20),  # want this low
        0.0 if zone.covered else 1.0,                 # 0 = covered (good)
        0.0 if zone.ev_support else 1.0,              # 0 = has EV support
    ]


def query_vector(req: SuggestRequest) -> List[float]:
    vt = req.vehicle_type.lower()
    return [
        0.0,                               # prefer low congestion
        0.0,                               # prefer cheap
        0.0,                               # prefer short walk
        0.0 if req.prefer_covered else 0.5,
        0.0 if vt == "ev" else 0.7,
    ]


def build_filter(req: SuggestRequest) -> Filter:
    vt = req.vehicle_type.lower()
    conditions = [FieldCondition(key="city", match=MatchValue(value=req.city))]
    if vt == "ev":
        conditions.append(FieldCondition(key="ev_support", match=MatchValue(value=True)))
    return Filter(must=conditions)


# ---------------------------------------------------------
# COLLECTION + SEEDING
# ---------------------------------------------------------

def init_collection() -> None:
    client.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.EUCLID),
    )

    # Index for filtering by city
    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="city",
        field_schema=PayloadSchemaType.KEYWORD,
    )

    # Index for filtering by EV support (not required, but good practice)
    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="ev_support",
        field_schema=PayloadSchemaType.BOOL,
    )


def seed_data() -> None:
    global SEED_ZONES

    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Seed data not found at {DATA_PATH}")

    raw = json.loads(DATA_PATH.read_text())
    zones = [ParkingZone(**zone) for zone in raw]

    points = [
        PointStruct(
            id=z.id,
            vector=build_vector(z),
            payload={
                "id": z.id,
                "name": z.name,
                "city": z.city,
                "lat": z.lat,
                "lng": z.lng,
                "congestion_now": z.congestion_now,
                "price_per_hour": z.price_per_hour,
                "walking_time_minutes": z.walking_time_minutes,
                "covered": z.covered,
                "ev_support": z.ev_support,
                "amenities": z.amenities or [],
                "congestion_now": z.congestion_now,
                "safety_score": z.safety_score,
            },
        )
        for z in zones
    ]

    client.upsert(collection_name=COLLECTION_NAME, points=points)
    SEED_ZONES = zones


def build_directions_url(
    origin_lat: Optional[float],
    origin_lng: Optional[float],
    dest_lat: float,
    dest_lng: float,
) -> str:
    destination = f"{dest_lat},{dest_lng}"
    if origin_lat is not None and origin_lng is not None:
        origin = f"{origin_lat},{origin_lng}"
        return (
            "https://www.google.com/maps/dir/?api=1"
            f"&origin={origin}&destination={destination}"
        )
    return f"https://www.google.com/maps/search/?api=1&query={destination}"


def resolve_origin(req: SuggestRequest) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    if req.origin_lat is not None and req.origin_lng is not None:
        return req.origin_lat, req.origin_lng, "user"
    if req.origin_text and GOOGLE_MAPS_API_KEY:
        geo = geocode_text(req.origin_text, req.city)
        if geo:
            lat, lng, _label = geo
            return lat, lng, "address"
    centroid = CITY_CENTROIDS.get(req.city)
    if centroid:
        return centroid[0], centroid[1], "city"
    return None, None, None


def clamp(value: float, *, min_value: float = 0.0, max_value: float = 1.0) -> float:
    return max(min_value, min(max_value, value))


def geocode_text(query: str, city: Optional[str] = None) -> Optional[Tuple[float, float, str]]:
    if not query or not GOOGLE_MAPS_API_KEY:
        return None

    params = {
        "address": query,
        "key": GOOGLE_MAPS_API_KEY,
        "region": "ae",
    }
    if city:
        params["components"] = f"country:AE|locality:{city}"

    try:
        response = requests.get(GOOGLE_GEOCODE_URL, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        print(f"Google Geocode error: {exc}")
        return None

    results = data.get("results", [])
    if not results:
        return None

    top = results[0]
    location = top.get("geometry", {}).get("location")
    if not location:
        return None

    return location.get("lat"), location.get("lng"), top.get("formatted_address", query)


def build_place_amenities(place_types: Optional[List[str]]) -> List[str]:
    if not place_types:
        return ["Live data"]
    mapping = {
        "parking": "Structured parking",
        "parking_lot": "Surface lot",
        "establishment": "Staffed",
        "point_of_interest": "Wayfinding",
        "food": "Nearby food",
        "shopping_mall": "Mall access",
        "airport": "Airport",
        "electric_vehicle_charging_station": "EV charging",
    }
    amenities = []
    for item in place_types:
        label = mapping.get(item)
        if label and label not in amenities:
            amenities.append(label)
    return amenities or ["Live data"]


def estimate_price(city: str, price_level: Optional[int]) -> float:
    if price_level is not None:
        return PRICE_LEVEL_TO_AED.get(price_level, 10.0)
    defaults = {
        "Dubai": 10.0,
        "Abu Dhabi": 8.0,
        "Sharjah": 5.0,
    }
    return defaults.get(city, 8.0)


def fetch_live_parking(
    origin_lat: Optional[float],
    origin_lng: Optional[float],
    city: str,
    limit: int,
    origin_source: Optional[str],
) -> List[SuggestResult]:
    if (
        origin_lat is None
        or origin_lng is None
        or not GOOGLE_MAPS_API_KEY
    ):
        return []

    params = {
        "location": f"{origin_lat},{origin_lng}",
        "radius": PLACES_RADIUS_METERS,
        "type": "parking",
        "keyword": city,
        "opennow": "true",
        "key": GOOGLE_MAPS_API_KEY,
    }

    try:
        response = requests.get(GOOGLE_PLACES_URL, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        print(f"Google Places error: {exc}")
        return []

    live_results: List[SuggestResult] = []
    for idx, place in enumerate(data.get("results", [])):
        geometry = place.get("geometry", {}).get("location")
        if not geometry:
            continue

        price_level = place.get("price_level")
        place_types = place.get("types", [])
        place_id = place.get("place_id") or idx
        result = SuggestResult(
            id=abs(hash(place_id)) % 1_000_000_000,
            name=place.get("name", "Parking option"),
            city=city,
            price_per_hour=estimate_price(city, price_level),
            lat=geometry.get("lat"),
            lng=geometry.get("lng"),
            walking_time_minutes=6.0,
            covered="parking" in place_types or "parking_garage" in place_types,
            ev_support="electric_vehicle_charging_station" in place_types,
            amenities=build_place_amenities(place_types),
            score=0.0,
            open_spots=None,
            origin_source=origin_source or "live",
            request_origin_lat=origin_lat,
            request_origin_lng=origin_lng,
        )
        live_results.append(result)
        if len(live_results) >= limit:
            break

    return live_results
def enrich_with_distance_data(
    results: List[SuggestResult],
    origin_lat: Optional[float],
    origin_lng: Optional[float],
) -> None:
    if not results:
        return

    # Always provide a directions URL even without Google Distance Matrix
    for result in results:
        result.directions_url = build_directions_url(origin_lat, origin_lng, result.lat, result.lng)

    if origin_lat is None or origin_lng is None or not GOOGLE_MAPS_API_KEY:
        return

    destinations = "|".join(f"{r.lat},{r.lng}" for r in results)
    params = {
        "origins": f"{origin_lat},{origin_lng}",
        "destinations": destinations,
        "mode": "driving",
        "units": "metric",
        "departure_time": "now",
        "traffic_model": "best_guess",
        "key": GOOGLE_MAPS_API_KEY,
    }

    try:
        response = requests.get(GOOGLE_DISTANCE_URL, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        print(f"Google Distance Matrix error: {exc}")
        return

    rows = data.get("rows", [])
    if not rows:
        return

    elements = rows[0].get("elements", [])
    for result, element in zip(results, elements):
        if element.get("status") != "OK":
            continue
        distance = element.get("distance")
        duration = element.get("duration")
        if distance:
            distance_val = distance.get("value")
            result.distance_meters = distance_val
            result.distance_text = distance.get("text")
            if distance_val and (result.walking_time_minutes is None or result.walking_time_minutes <= 0):
                approx_walk = max(distance_val / 80, 2)
                result.walking_time_minutes = round(approx_walk, 1)
        duration_in_traffic = element.get("duration_in_traffic")
        if duration:
            base_duration_val = duration.get("value")
            result.duration_seconds = base_duration_val
            result.duration_text = duration.get("text")
            result.travel_time_minutes = round(base_duration_val / 60, 2) if base_duration_val else None
        if duration_in_traffic:
            traffic_val = duration_in_traffic.get("value")
            result.duration_in_traffic_seconds = traffic_val
            result.duration_in_traffic_text = duration_in_traffic.get("text")
            if traffic_val and result.duration_seconds:
                ratio = traffic_val / max(result.duration_seconds, 1)
                result.congestion_score = clamp(ratio - 1, min_value=0.0, max_value=1.0)
            if traffic_val:
                result.travel_time_minutes = round(traffic_val / 60, 2)
                result.duration_text = result.duration_in_traffic_text or result.duration_text


# ---------------------------------------------------------
# FASTAPI APP
# ---------------------------------------------------------

app = FastAPI()

# CORS – allow your static frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for local dev; tighten later if you want
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_collection()
    seed_data()
    print("✓ Qdrant collection created and seeded.")


# ---------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


def apply_recommendation_scores(results: List[SuggestResult]) -> None:
    if not results:
        return

    for result in results:
        congestion = result.congestion_score if result.congestion_score is not None else 0.4
        travel_minutes = (
            (result.duration_in_traffic_seconds or result.duration_seconds or 0) / 60
        )
        travel_norm = clamp(travel_minutes / MAX_TRAVEL_MINUTES)
        price_norm = clamp(result.price_per_hour / MAX_PRICE_AED) if result.price_per_hour is not None else 0.2
        walk_norm = clamp(result.walking_time_minutes / MAX_WALK_MINUTES) if result.walking_time_minutes is not None else 0.3

        recommendation = (
            (1 - congestion) * 0.4
            + (1 - travel_norm) * 0.25
            + (1 - price_norm) * 0.2
            + (1 - walk_norm) * 0.15
        )

        result.recommendation_score = round(recommendation, 3)
        confidence = int(recommendation * 100)
        result.confidence = int(clamp(confidence, min_value=55, max_value=98))
        result.open_spots = max(3, int((1 - congestion) * 50))


@app.post("/suggest", response_model=List[SuggestResult])
def suggest(req: SuggestRequest):
    origin_lat, origin_lng, origin_source = resolve_origin(req)

    results = fetch_live_parking(origin_lat, origin_lng, req.city, req.results, origin_source)

    if len(results) < req.results:
        hits = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector(req),
            query_filter=build_filter(req),
            limit=req.results,
        )

        fallback = [
            SuggestResult(
                id=h.payload["id"],
                name=h.payload["name"],
                city=h.payload["city"],
                price_per_hour=h.payload["price_per_hour"],
                lat=h.payload["lat"],
                lng=h.payload["lng"],
                walking_time_minutes=h.payload["walking_time_minutes"],
                covered=h.payload["covered"],
                ev_support=h.payload["ev_support"],
                amenities=h.payload.get("amenities", []),
                open_spots=max(5, int((1 - h.payload.get("congestion_now", 0.5)) * 40)),
                score=h.score,
                origin_source=origin_source,
                request_origin_lat=origin_lat,
                request_origin_lng=origin_lng,
            )
            for h in hits
        ]
        results.extend(fallback)
        results = results[: req.results]

    for result in results:
        if result.request_origin_lat is None:
            result.request_origin_lat = origin_lat
        if result.request_origin_lng is None:
            result.request_origin_lng = origin_lng

    enrich_with_distance_data(results, origin_lat, origin_lng)
    apply_recommendation_scores(results)
    results.sort(key=lambda r: r.recommendation_score or 0, reverse=True)
    return results[: req.results]


@app.get("/geocode", response_model=GeocodeResponse)
def geocode_endpoint(text: str, city: Optional[str] = None):
    geo = geocode_text(text, city)
    if not geo:
        raise HTTPException(status_code=404, detail="Location not found")
    lat, lng, label = geo
    return GeocodeResponse(lat=lat, lng=lng, label=label)


@app.get("/insights", response_model=List[Insight])
def insights(city: str = "Dubai"):
    return [
        Insight(title="Parking trending", detail=f"Live patterns for {city}", severity="info"),
        Insight(title="Demand up", detail=f"Peak-hour demand rising in {city}", severity="warning"),
    ]


@app.get("/timeline", response_model=List[TimelineEvent])
def timeline(city: str = "Dubai"):
    now = datetime.utcnow().strftime("%H:%M")
    return [
        TimelineEvent(time=now, title="Sensor sync", detail=f"Refreshing nodes in {city}", severity="info")
    ]


@app.get("/status-board", response_model=List[HealthStatus])
def status_board():
    return [
        HealthStatus(label="Telemetry", value="Nominal", severity="success"),
        HealthStatus(label="Pricing", value="Stable", severity="success"),
    ]


@app.get("/dispatch", response_model=List[DispatchEvent])
def dispatch():
    return [
        DispatchEvent(message="Routing driver to Marina Deck"),
        DispatchEvent(message="EV bay recalibration scheduled"),
    ]


@app.get("/config")
def get_config():
    """Return frontend configuration including Google Maps API key."""
    return {
        "google_maps_api_key": GOOGLE_MAPS_API_KEY or "",
    }
