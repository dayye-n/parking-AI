"""Pydantic schemas for parking recommendations."""
from pydantic import BaseModel, Field
from typing import List, Optional


class RecommendationRequest(BaseModel):
    """Request body for parking recommendations."""
    origin_lat: float = Field(..., description="Origin latitude")
    origin_lng: float = Field(..., description="Origin longitude")
    destination_place_id: str = Field(..., description="Google Places place_id for destination")
    results: int = Field(default=6, ge=1, le=20, description="Number of results to return")
    radius_m: int = Field(default=1200, ge=100, le=5000, description="Search radius in meters")
    sort: str = Field(default="best", description="Sort mode: best, distance, price, rating, congestion")


class RecommendationResponse(BaseModel):
    """Single parking recommendation."""
    id: str = Field(..., description="Unique identifier (place_id)")
    name: str = Field(..., description="Parking location name")
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")
    distance_meters_drive: int = Field(..., description="Driving distance from origin in meters")
    duration_drive_seconds: int = Field(..., description="Driving duration in seconds")
    duration_drive_in_traffic_seconds: int = Field(..., description="Driving duration with traffic in seconds")
    walk_minutes: float = Field(..., description="Walking time from parking to destination in minutes")
    price_per_hour: float = Field(..., description="Estimated price per hour in AED")
    congestion_score: float = Field(..., ge=0, le=1, description="Congestion score 0-1 (0=no traffic, 1=heavy traffic)")
    score: float = Field(..., ge=0, le=1, description="Overall recommendation score 0-1")
    reasons: List[str] = Field(default_factory=list, description="Why this parking is recommended")
    google_maps_directions_url: str = Field(..., description="URL to open in Google Maps")


class RecommendationsResponse(BaseModel):
    """Response containing list of recommendations."""
    recommendations: List[RecommendationResponse]
    destination_name: str
    destination_address: str

