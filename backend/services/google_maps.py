"""Google Maps API service - all Google API calls go through here."""
import os
from typing import List, Optional, Tuple, Dict, Any
import requests
from dotenv import load_dotenv

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
GOOGLE_PLACES_AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
GOOGLE_PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GOOGLE_PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
GOOGLE_DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"

CITY_CENTROIDS: Dict[str, Tuple[float, float]] = {
    "Dubai": (25.2048, 55.2708),
    "Abu Dhabi": (24.4539, 54.3773),
    "Sharjah": (25.3463, 55.4209),
}

PRICE_LEVEL_TO_AED: Dict[int, float] = {
    0: 0.0,
    1: 4.0,
    2: 8.0,
    3: 15.0,
    4: 30.0,
}


def get_api_key() -> str:
    """Get Google Maps API key, raise if missing."""
    if not GOOGLE_MAPS_API_KEY:
        raise ValueError("GOOGLE_MAPS_API_KEY not configured")
    return GOOGLE_MAPS_API_KEY


def places_autocomplete(
    query: str,
    city: Optional[str] = None,
    session_token: Optional[str] = None
) -> List[Dict[str, str]]:
    """
    Get place autocomplete suggestions.
    Returns: [{ description, place_id }]
    """
    if not query:
        return []
    
    api_key = get_api_key()
    params: Dict[str, Any] = {
        "input": query,
        "key": api_key,
        "components": "country:ae",
    }
    
    if city and city in CITY_CENTROIDS:
        lat, lng = CITY_CENTROIDS[city]
        params["location"] = f"{lat},{lng}"
        params["radius"] = 50000  # 50km bias
    
    if session_token:
        params["sessiontoken"] = session_token
    
    try:
        response = requests.get(GOOGLE_PLACES_AUTOCOMPLETE_URL, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") != "OK":
            return []
        
        return [
            {
                "description": pred.get("description", ""),
                "place_id": pred.get("place_id", ""),
            }
            for pred in data.get("predictions", [])
        ]
    except requests.RequestException as e:
        raise ValueError(f"Google Places Autocomplete error: {e}")


def places_details(place_id: str) -> Dict[str, Any]:
    """
    Get place details by place_id.
    Returns: { place_id, name, address, lat, lng }
    """
    api_key = get_api_key()
    params = {
        "place_id": place_id,
        "fields": "place_id,name,formatted_address,geometry",
        "key": api_key,
    }
    
    try:
        response = requests.get(GOOGLE_PLACES_DETAILS_URL, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") != "OK":
            raise ValueError(f"Google Places Details error: {data.get('status')}")
        
        result = data.get("result", {})
        location = result.get("geometry", {}).get("location", {})
        
        return {
            "place_id": result.get("place_id", ""),
            "name": result.get("name", ""),
            "address": result.get("formatted_address", ""),
            "lat": location.get("lat"),
            "lng": location.get("lng"),
        }
    except requests.RequestException as e:
        raise ValueError(f"Google Places Details error: {e}")


def places_nearby_search(
    lat: float,
    lng: float,
    radius_m: int = 1200,
    type_filter: str = "parking"
) -> List[Dict[str, Any]]:
    """
    Search for nearby places.
    Returns list of place results with name, place_id, location, price_level, types.
    """
    api_key = get_api_key()
    params = {
        "location": f"{lat},{lng}",
        "radius": radius_m,
        "type": type_filter,
        "key": api_key,
    }
    
    try:
        response = requests.get(GOOGLE_PLACES_NEARBY_URL, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") not in ["OK", "ZERO_RESULTS"]:
            raise ValueError(f"Google Places Nearby error: {data.get('status')}")
        
        results = []
        for place in data.get("results", []):
            location = place.get("geometry", {}).get("location", {})
            results.append({
                "place_id": place.get("place_id", ""),
                "name": place.get("name", ""),
                "lat": location.get("lat"),
                "lng": location.get("lng"),
                "price_level": place.get("price_level"),
                "types": place.get("types", []),
                "rating": place.get("rating", 0.0),
            })
        
        return results
    except requests.RequestException as e:
        raise ValueError(f"Google Places Nearby error: {e}")


def distance_matrix(
    origins: List[Tuple[float, float]],
    destinations: List[Tuple[float, float]],
    mode: str = "driving",
    departure_time: Optional[str] = "now"
) -> List[Dict[str, Any]]:
    """
    Get distance and duration between origins and destinations.
    Returns list of results, one per origin-destination pair.
    Each result: { distance_meters, duration_seconds, duration_in_traffic_seconds, status }
    """
    api_key = get_api_key()
    
    origins_str = "|".join(f"{lat},{lng}" for lat, lng in origins)
    destinations_str = "|".join(f"{lat},{lng}" for lat, lng in destinations)
    
    params: Dict[str, Any] = {
        "origins": origins_str,
        "destinations": destinations_str,
        "mode": mode,
        "key": api_key,
        "units": "metric",
    }
    
    if departure_time == "now" and mode == "driving":
        params["departure_time"] = "now"
        params["traffic_model"] = "best_guess"
    
    try:
        response = requests.get(GOOGLE_DISTANCE_MATRIX_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") != "OK":
            raise ValueError(f"Google Distance Matrix error: {data.get('status')}")
        
        results = []
        rows = data.get("rows", [])
        
        for row in rows:
            elements = row.get("elements", [])
            for element in elements:
                status = element.get("status")
                if status != "OK":
                    results.append({
                        "distance_meters": None,
                        "duration_seconds": None,
                        "duration_in_traffic_seconds": None,
                        "status": status,
                    })
                    continue
                
                distance = element.get("distance", {}).get("value")
                duration = element.get("duration", {}).get("value")
                duration_in_traffic = element.get("duration_in_traffic", {}).get("value")
                
                results.append({
                    "distance_meters": distance,
                    "duration_seconds": duration,
                    "duration_in_traffic_seconds": duration_in_traffic or duration,
                    "status": "OK",
                })
        
        return results
    except requests.RequestException as e:
        raise ValueError(f"Google Distance Matrix error: {e}")


def estimate_price(city: Optional[str] = None, price_level: Optional[int] = None) -> float:
    """Estimate parking price per hour in AED."""
    if price_level is not None:
        return PRICE_LEVEL_TO_AED.get(price_level, 10.0)
    
    defaults = {
        "Dubai": 10.0,
        "Abu Dhabi": 8.0,
        "Sharjah": 5.0,
    }
    return defaults.get(city or "Dubai", 8.0)

