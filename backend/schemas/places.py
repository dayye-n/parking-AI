"""Pydantic schemas for Google Places API."""
from pydantic import BaseModel
from typing import List, Optional


class AutocompleteSuggestion(BaseModel):
    """Single autocomplete suggestion."""
    description: str
    place_id: str


class AutocompleteResponse(BaseModel):
    """Response for autocomplete endpoint."""
    suggestions: List[AutocompleteSuggestion]


class PlaceDetailsResponse(BaseModel):
    """Response for place details endpoint."""
    place_id: str
    name: str
    address: str
    lat: float
    lng: float

