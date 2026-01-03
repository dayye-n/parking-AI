"""Pydantic v2 schemas for request/response validation."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# Auth schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None


# ParkingSpot schemas
class ParkingSpotBase(BaseModel):
    title: str
    location: str
    status: Optional[str] = "active"
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None


class ParkingSpotCreate(ParkingSpotBase):
    pass


class ParkingSpotUpdate(BaseModel):
    title: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None


class ParkingSpotResponse(ParkingSpotBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

