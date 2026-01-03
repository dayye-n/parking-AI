"""Schemas package - re-export main schemas for backward compatibility."""
from .schemas import (
    UserCreate,
    UserResponse,
    Token,
    ParkingSpotCreate,
    ParkingSpotUpdate,
    ParkingSpotResponse,
)

__all__ = [
    "UserCreate",
    "UserResponse",
    "Token",
    "ParkingSpotCreate",
    "ParkingSpotUpdate",
    "ParkingSpotResponse",
]
