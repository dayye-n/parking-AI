import os
from datetime import datetime
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
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

COLLECTION_NAME = "parking_zones"
VECTOR_SIZE = 5

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


class SuggestResult(BaseModel):
    name: str
    city: str
    price_per_hour: float
    lat: float
    lng: float
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
            id=5,
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
            },
        )
        for z in zones
    ]

    client.upsert(collection_name=COLLECTION_NAME, points=points)
    SEED_ZONES = zones


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


@app.post("/suggest", response_model=List[SuggestResult])
def suggest(req: SuggestRequest):
    hits = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector(req),
        query_filter=build_filter(req),
        limit=req.results,
    )

    return [
        SuggestResult(
            name=h.payload["name"],
            city=h.payload["city"],
            price_per_hour=h.payload["price_per_hour"],
            lat=h.payload["lat"],
            lng=h.payload["lng"],
            walking_time_minutes=h.payload["walking_time_minutes"],
            covered=h.payload["covered"],
            ev_support=h.payload["ev_support"],
            score=h.score,
        )
        for h in hits
    ]


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