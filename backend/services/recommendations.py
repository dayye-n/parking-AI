"""Parking recommendation service."""
from typing import List, Dict, Any
from services import google_maps
from schemas.recommendations import RecommendationResponse


def clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
    """Clamp value between min and max."""
    return max(min_value, min(max_value, value))


def calculate_congestion_score(
    duration_seconds: int,
    duration_in_traffic_seconds: int
) -> float:
    """Calculate congestion score from traffic delay."""
    if not duration_seconds or duration_seconds <= 0:
        return 0.5  # Default if no data
    
    ratio = duration_in_traffic_seconds / max(duration_seconds, 1)
    congestion = clamp(ratio - 1.0, 0.0, 1.0)
    return congestion


def calculate_overall_score(
    walk_minutes: float,
    congestion_score: float,
    drive_minutes: float,
    price_per_hour: float
) -> float:
    """Calculate overall recommendation score (0-1, higher is better)."""
    # Normalize factors (lower is better for all)
    walk_norm = clamp(walk_minutes / 15.0)  # 15 min max walk
    drive_norm = clamp(drive_minutes / 60.0)  # 60 min max drive
    price_norm = clamp(price_per_hour / 30.0)  # 30 AED max price
    
    # Weighted combination (lower normalized values = better score)
    score = (
        (1 - walk_norm) * 0.35 +      # Walk time is most important
        (1 - congestion_score) * 0.30 +  # Congestion second
        (1 - drive_norm) * 0.20 +     # Drive time third
        (1 - price_norm) * 0.15       # Price least important
    )
    
    return clamp(score)


def generate_reasons(
    rec: RecommendationResponse,
    all_recs: List[RecommendationResponse]
) -> List[str]:
    """Generate human-readable reasons why this parking is recommended."""
    reasons = []
    
    # Check if shortest walk
    shortest_walk = min(r.walk_minutes for r in all_recs)
    if rec.walk_minutes <= shortest_walk + 0.5:  # Within 0.5 min
        reasons.append("Shortest walk to destination")
    
    # Check if lowest congestion
    lowest_congestion = min(r.congestion_score for r in all_recs)
    if rec.congestion_score <= lowest_congestion + 0.1:
        reasons.append("Lower traffic vs alternatives")
    
    # Check if lowest price
    lowest_price = min(r.price_per_hour for r in all_recs)
    if rec.price_per_hour <= lowest_price + 1.0:
        reasons.append("Affordable parking")
    
    # Check if shortest drive
    shortest_drive = min(r.duration_drive_seconds for r in all_recs)
    if rec.duration_drive_seconds <= shortest_drive + 60:  # Within 1 min
        reasons.append("Shortest drive from origin")
    
    # Default if no specific reason
    if not reasons:
        reasons.append("Good balance of cost and convenience")
    
    return reasons


def build_directions_url(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float
) -> str:
    """Build Google Maps directions URL."""
    return (
        f"https://www.google.com/maps/dir/?api=1"
        f"&origin={origin_lat},{origin_lng}"
        f"&destination={dest_lat},{dest_lng}"
    )


def get_parking_recommendations(
    origin_lat: float,
    origin_lng: float,
    destination_place_id: str,
    results: int = 6,
    radius_m: int = 1200,
    sort: str = "best"
) -> tuple[List[RecommendationResponse], str, str]:
    """
    Get parking recommendations.
    Returns: (recommendations, destination_name, destination_address)
    """
    # 1. Get destination details
    dest_details = google_maps.places_details(destination_place_id)
    dest_lat = dest_details["lat"]
    dest_lng = dest_details["lng"]
    dest_name = dest_details["name"]
    dest_address = dest_details["address"]
    
    # 2. Find nearby parking around destination
    parking_candidates = google_maps.places_nearby_search(
        lat=dest_lat,
        lng=dest_lng,
        radius_m=radius_m,
        type_filter="parking"
    )
    
    if not parking_candidates:
        raise ValueError("No parking found near destination")
    
    # Get more candidates than needed for better ranking
    candidates_to_process = min(len(parking_candidates), results * 2)
    parking_candidates = parking_candidates[:candidates_to_process]
    
    # 3. Compute driving distance/duration from origin to each parking
    origins = [(origin_lat, origin_lng)]
    destinations = [(c["lat"], c["lng"]) for c in parking_candidates]
    
    drive_results = google_maps.distance_matrix(
        origins=origins,
        destinations=destinations,
        mode="driving",
        departure_time="now"
    )
    
    # 4. Compute walking time from each parking to destination
    walk_origins = [(c["lat"], c["lng"]) for c in parking_candidates]
    walk_destinations = [(dest_lat, dest_lng)]
    
    walk_results = []
    for origin in walk_origins:
        result = google_maps.distance_matrix(
            origins=[origin],
            destinations=walk_destinations,
            mode="walking"
        )
        walk_results.extend(result)
    
    # 5. Build recommendations
    recommendations = []
    for i, candidate in enumerate(parking_candidates):
        drive_data = drive_results[i] if i < len(drive_results) else {}
        walk_data = walk_results[i] if i < len(walk_results) else {}
        
        if drive_data.get("status") != "OK" or walk_data.get("status") != "OK":
            continue  # Skip if distance calculation failed
        
        drive_distance = drive_data.get("distance_meters", 0)
        drive_duration = drive_data.get("duration_seconds", 0)
        drive_duration_traffic = drive_data.get("duration_in_traffic_seconds", drive_duration)
        walk_duration = walk_data.get("duration_seconds", 0)
        walk_minutes = walk_duration / 60.0 if walk_duration else 0
        
        congestion_score = calculate_congestion_score(drive_duration, drive_duration_traffic)
        drive_minutes = drive_duration / 60.0
        price_per_hour = google_maps.estimate_price(price_level=candidate.get("price_level"))
        
        overall_score = calculate_overall_score(
            walk_minutes=walk_minutes,
            congestion_score=congestion_score,
            drive_minutes=drive_minutes,
            price_per_hour=price_per_hour
        )
        
        directions_url = build_directions_url(
            origin_lat, origin_lng,
            candidate["lat"], candidate["lng"]
        )
        
        rec = RecommendationResponse(
            id=candidate["place_id"],
            name=candidate["name"],
            lat=candidate["lat"],
            lng=candidate["lng"],
            distance_meters_drive=drive_distance,
            duration_drive_seconds=drive_duration,
            duration_drive_in_traffic_seconds=drive_duration_traffic,
            walk_minutes=round(walk_minutes, 1),
            price_per_hour=round(price_per_hour, 2),
            congestion_score=round(congestion_score, 2),
            score=round(overall_score, 3),
            reasons=[],  # Will be filled after sorting
            google_maps_directions_url=directions_url,
        )
        recommendations.append(rec)
    
    if not recommendations:
        raise ValueError("No valid parking recommendations found")
    
    # 6. Sort recommendations
    if sort == "distance":
        recommendations.sort(key=lambda r: r.distance_meters_drive)
    elif sort == "price":
        recommendations.sort(key=lambda r: r.price_per_hour)
    elif sort == "congestion":
        recommendations.sort(key=lambda r: r.congestion_score)
    else:  # "best" or default
        recommendations.sort(key=lambda r: r.score, reverse=True)
    
    # 7. Generate reasons for each recommendation
    for rec in recommendations:
        rec.reasons = generate_reasons(rec, recommendations)
    
    # 8. Return top N results
    return recommendations[:results], dest_name, dest_address

