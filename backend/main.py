import os
from typing import List

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

# ---------- ENV & QDRANT SETUP ----------

load_dotenv()  # load values from .env file

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

# We store a simple 4D vector for each parking zone:
# [congestion_now, price_norm, walking_time_norm, covered_flag]
VECTOR_SIZE = 4
COLLECTION_NAME = "parking_zones"

client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY or None,
)


def init_collection() -> None:
    client.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(
            size=VECTOR_SIZE,
            distance=Distance.EUCLID,
        ),
    )

    # Create an index on the "city" payload field so we can filter by it
    client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="city",
        field_schema=PayloadSchemaType.KEYWORD,
    )


# ---------- DATA MODELS ----------

class ParkingZone(BaseModel):
    id: int
    name: str
    city: str  # "Dubai" or "Abu Dhabi"
    lat: float
    lng: float
    congestion_now: float          # 0 = free, 1 = very congested
    price_per_hour: float          # AED
    walking_time_minutes: float    # avg walk time to area
    covered: bool


class SuggestRequest(BaseModel):
    city: str                  # "Dubai" or "Abu Dhabi"
    results: int = 5
    prefer_covered: bool = True


class SuggestResult(BaseModel):
    name: str
    city: str
    lat: float
    lng: float
    price_per_hour: float
    walking_time_minutes: float
    covered: bool
    score: float               # similarity score from Qdrant


# ---------- HELPERS ----------

def normalize(value: float, min_v: float, max_v: float) -> float:
    if max_v == min_v:
        return 0.0
    return (value - min_v) / (max_v - min_v)


def build_parking_vector(zone: ParkingZone) -> List[float]:
    """
    Turn a parking zone into a 4D vector.
    Lower is better on first 3 dimensions.
    """
    congestion_norm = zone.congestion_now                 # already 0–1
    price_norm = normalize(zone.price_per_hour, 0, 50)    # assume 0–50 AED/hr
    walking_norm = normalize(zone.walking_time_minutes, 0, 20)  # 0–20 mins
    covered_flag = 0.0 if zone.covered else 1.0           # 0 good (covered), 1 bad

    return [congestion_norm, price_norm, walking_norm, covered_flag]


def ideal_query_vector(req: SuggestRequest) -> List[float]:
    """
    Our 'ideal' parking:
    - 0 congestion
    - 0 price
    - 0 walking time
    - 0 if prefer covered, 0.5 otherwise
    """
    base = [0.0, 0.0, 0.0]
    covered_pref = 0.0 if req.prefer_covered else 0.5
    return base + [covered_pref]


# ---------- FASTAPI APP ----------

app = FastAPI()


@app.on_event("startup")
def startup_event():
    """
    When the app starts:
    - create/reset the collection
    - insert some demo parking zones
    """
    init_collection()
    seed_demo_data()


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- SEED SOME DEMO PARKING ZONES ----------

def seed_demo_data() -> None:
    """
    Hard-coded zones just to get started.
    Later we can swap this for real data from a DB.
    """
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
        ),
    ]

    points = []
    for z in zones:
        vec = build_parking_vector(z)
        points.append(
            PointStruct(
                id=z.id,
                vector=vec,
                payload={
                    "name": z.name,
                    "city": z.city,
                    "lat": z.lat,
                    "lng": z.lng,
                    "price_per_hour": z.price_per_hour,
                    "walking_time_minutes": z.walking_time_minutes,
                    "covered": z.covered,
                },
            )
        )

    client.upsert(collection_name=COLLECTION_NAME, points=points)


# ---------- SUGGEST PARKING ENDPOINT ----------

@app.post("/suggest", response_model=List[SuggestResult])
def suggest_parking(req: SuggestRequest):
    """
    Suggest the best parking zones in the chosen city.
    """
    query_vec = ideal_query_vector(req)

    # Only look in the selected city
    query_filter = Filter(
        must=[
            FieldCondition(
                key="city",
                match=MatchValue(value=req.city),
            )
        ]
    )

    hits = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vec,
        query_filter=query_filter,
        limit=req.results,
    )

    results: List[SuggestResult] = []
    for h in hits:
        payload = h.payload
        results.append(
            SuggestResult(
                name=payload["name"],
                city=payload["city"],
                lat=payload["lat"],
                lng=payload["lng"],
                price_per_hour=payload["price_per_hour"],
                walking_time_minutes=payload["walking_time_minutes"],
                covered=payload["covered"],
                score=h.score,
            )
        )

    return results