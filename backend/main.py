import os
from datetime import datetime, timedelta
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
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

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

VECTOR_SIZE = 5
COLLECTION_NAME = "parking_zones"

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY or None)

SEED_ZONES: List["ParkingZone"] = []


def init_collection() -> None:
    client.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.EUCLID),
    )

    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="city",
        field_schema=PayloadSchemaType.KEYWORD,
    )

    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="ev_support",
        field_schema=PayloadSchemaType.BOOL,
    )


class ParkingZone(BaseModel):
    id: int
    name: str
    city: str
    lat: float
    lng: float
    congestion_now: float
    price_per_hour: float
    walking_time_minutes: float
    covered: bool
    ev_support: bool
    safety_score: float = 0.8
    amenities: Optional[List[str]] = None


class SuggestRequest(BaseModel):
    city: str
    results: int = 5
    prefer_covered: bool = True
    vehicle_type: str = "standard"
    duration_hours: int = 1
    arrival_iso: Optional[str] = None


class SuggestResult(BaseModel):
    name: str
    city: str
    lat: float
    lng: float
    price_per_hour: float
    walking_time_minutes: float
    covered: bool
    ev_support: bool
    score: float


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


def normalize(value: float, min_v: float, max_v: float) -> float:
    if max_v == min_v:
        return 0.0
    return (value - min_v) / (max_v - min_v)


def build_parking_vector(zone: ParkingZone) -> List[float]:
    congestion_norm = zone.congestion_now
    price_norm = normalize(zone.price_per_hour, 0, 50)
    walking_norm = normalize(zone.walking_time_minutes, 0, 20)
    covered_flag = 0.0 if zone.covered else 1.0
    ev_flag = 0.0 if zone.ev_support else 1.0
    return [congestion_norm, price_norm, walking_norm, covered_flag, ev_flag]


def ideal_query_vector(req: SuggestRequest) -> List[float]:
    covered_pref = 0.0 if req.prefer_covered else 0.5
    ev_pref = 0.0 if req.vehicle_type.lower() == "ev" else 0.7
    return [0.0, 0.0, 0.0, covered_pref, ev_pref]


def vehicle_filter_conditions(req: SuggestRequest) -> List[FieldCondition]:
    conditions: List[FieldCondition] = [FieldCondition(key="city", match=MatchValue(value=req.city))]
    if req.vehicle_type.lower() == "ev":
        conditions.append(FieldCondition(key="ev_support", match=MatchValue(value=True)))
    return conditions


def city_snapshot(city: str) -> List[ParkingZone]:
    if not SEED_ZONES:
        return []
    matches = [zone for zone in SEED_ZONES if zone.city == city]
    return matches or SEED_ZONES


def generate_insights(city: str) -> List[Insight]:
    zones = city_snapshot(city)
    if not zones:
        return [
            Insight(
                title="No seed data loaded",
                detail="Initialize the Qdrant collection to unlock insights.",
                severity="warning",
            )
        ]

    avg_price = sum(z.price_per_hour for z in zones) / len(zones)
    covered_ratio = sum(1 for z in zones if z.covered) / len(zones)
    ev_ratio = sum(1 for z in zones if z.ev_support) / len(zones)
    best_zone = min(zones, key=lambda z: z.congestion_now)

    return [
        Insight(
            title=f"{city} EV utilization",
            detail=f"{ev_ratio:.0%} bays EV-ready across network.",
            severity="info",
        ),
        Insight(
            title="Tariff opportunity",
            detail=f"Average {avg_price:.1f} AED/hr, room for premium after dusk.",
            severity="success",
        ),
        Insight(
            title="Sheltered capacity",
            detail=f"{covered_ratio:.0%} of inventory covered, unlock long-stay upsell.",
            severity="info",
        ),
        Insight(
            title=f"{best_zone.name} trending",
            detail=f"Walking time {best_zone.walking_time_minutes} min, congestion {best_zone.congestion_now:.0%}.",
            severity="success",
        ),
    ]


def generate_timeline(city: str) -> List[TimelineEvent]:
    now = datetime.utcnow().replace(second=0, microsecond=0)
    increments = [0, 20, 45]
    labels = [
        ("Sensor sync", f"Refreshing curb cameras near {city} core."),
        ("EV hold window", "Allocating chargers to fleets."),
        ("Event surge prep", f"Deploying ambassadors in {city} downtown."),
    ]
    events: List[TimelineEvent] = []
    for idx, minutes in enumerate(increments):
        ts = (now + timedelta(minutes=minutes)).strftime("%H:%M")
        title, detail = labels[idx]
        severity = "warning" if "EV" in title else "info"
        if "surge" in title:
            severity = "success"
        events.append(TimelineEvent(time=ts, title=title, detail=detail, severity=severity))
    return events


def generate_health_statuses() -> List[HealthStatus]:
    return [
        HealthStatus(label="Telemetry ingestion", value="Nominal · 24k msgs/min", severity="success"),
        HealthStatus(label="Pricing engine", value="All shards synced", severity="success"),
        HealthStatus(label="Computer vision", value="1 alert · calibrate Bay 14", severity="warning"),
        HealthStatus(label="Incidents", value="0 escalations", severity="success"),
    ]


def generate_dispatch_feed() -> List[DispatchEvent]:
    return [
        DispatchEvent(message="Redirected driver Salman to Marina Deck L5, 32 slots free."),
        DispatchEvent(message="Valet crew requested EV cable swap at Downtown Oasis."),
        DispatchEvent(message="Tour bus permit confirmed for Gate C."),
    ]


app = FastAPI()


@app.on_event("startup")
def startup_event():
    init_collection()
    seed_demo_data()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/suggest", response_model=List[SuggestResult])
def suggest_parking(req: SuggestRequest):
    query_vec = ideal_query_vector(req)
    query_filter = Filter(must=vehicle_filter_conditions(req))
    limit = min(10, req.results + (1 if req.duration_hours > 3 else 0))

    hits = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vec,
        query_filter=query_filter,
        limit=limit,
    )

    results: List[SuggestResult] = []
    for hit in hits:
        payload = hit.payload
        results.append(
            SuggestResult(
                name=payload["name"],
                city=payload["city"],
                lat=payload["lat"],
                lng=payload["lng"],
                price_per_hour=payload["price_per_hour"],
                walking_time_minutes=payload["walking_time_minutes"],
                covered=payload["covered"],
                ev_support=payload.get("ev_support", False),
                score=hit.score,
            )
        )
    return results


@app.get("/insights", response_model=List[Insight])
def insights(city: str = "Dubai"):
    return generate_insights(city)


@app.get("/timeline", response_model=List[TimelineEvent])
def timeline(city: str = "Dubai"):
    return generate_timeline(city)


@app.get("/status-board", response_model=List[HealthStatus])
def status_board():
    return generate_health_statuses()


@app.get("/dispatch", response_model=List[DispatchEvent])
def dispatch_feed():
    return generate_dispatch_feed()


def seed_demo_data() -> None:
    global SEED_ZONES
    zones = [
        ParkingZone(
            id=1,
            name="Dubai Mall Parking P2",
            city="Dubai",
            lat=25.1989,
            lng=55.2793,
            congestion_now=0.7,
            price_per_hour=0.0,
            walking_time_minutes=5,
            covered=True,
            ev_support=True,
            amenities=["EV fast charge", "Security patrol"],
        ),
        ParkingZone(
            id=2,
            name="Business Bay Open Lot",
            city="Dubai",
            lat=25.1841,
            lng=55.2722,
            congestion_now=0.4,
            price_per_hour=10.0,
            walking_time_minutes=8,
            covered=False,
            ev_support=False,
            amenities=["Shuttle", "Lighting"],
        ),
        ParkingZone(
            id=3,
            name="Abu Dhabi Corniche Underground",
            city="Abu Dhabi",
            lat=24.4939,
            lng=54.3706,
            congestion_now=0.5,
            price_per_hour=4.0,
            walking_time_minutes=6,
            covered=True,
            ev_support=True,
            amenities=["CCTV", "Ticketless entry"],
        ),
        ParkingZone(
            id=4,
            name="Mussafah Open Yard",
            city="Abu Dhabi",
            lat=24.3347,
            lng=54.4890,
            congestion_now=0.2,
            price_per_hour=2.0,
            walking_time_minutes=10,
            covered=False,
            ev_support=False,
            amenities=["Wide bays"],
        ),
        ParkingZone(
            id=5,
            name="Sharjah Waterfront Promenade",
            city="Sharjah",
            lat=25.3474,
            lng=55.3846,
            congestion_now=0.35,
            price_per_hour=3.0,
            walking_time_minutes=4,
            covered=True,
            ev_support=True,
            amenities=["Shade sail", "Retail access"],
        ),
        ParkingZone(
            id=6,
            name="Expo City Mobility Hub",
            city="Dubai",
            lat=24.9717,
            lng=55.1552,
            congestion_now=0.6,
            price_per_hour=12.0,
            walking_time_minutes=7,
            covered=True,
            ev_support=True,
            amenities=["VIP valet", "Guided parking"],
        ),
    ]

    points = []
    for zone in zones:
        points.append(
            PointStruct(
                id=zone.id,
                vector=build_parking_vector(zone),
                payload={
                    "name": zone.name,
                    "city": zone.city,
                    "lat": zone.lat,
                    "lng": zone.lng,
                    "price_per_hour": zone.price_per_hour,
                    "walking_time_minutes": zone.walking_time_minutes,
                    "covered": zone.covered,
                    "ev_support": zone.ev_support,
                    "amenities": zone.amenities or [],
                },
            )
        )

    client.upsert(collection_name=COLLECTION_NAME, points=points)
    SEED_ZONES = zones

