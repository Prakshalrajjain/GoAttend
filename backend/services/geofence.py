import math


def haversine_distance_meters(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """
    Calculate the great-circle distance between two points on the Earth's surface
    using the Haversine formula.
    Returns distance in meters rounded to two decimal places.
    """
    # Earth mean radius in meters
    earth_radius_m = 6371000.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    distance = earth_radius_m * c
    return round(distance, 2)


def verify_location(
    user_lat: float,
    user_lon: float,
    office_lat: float,
    office_lon: float,
    allowed_radius_meters: int,
) -> tuple[bool, float]:
    """
    Verifies if user's coordinates fall within the authorized office radius.
    Returns (is_within_radius, actual_distance_meters).
    """
    dist = haversine_distance_meters(user_lat, user_lon, office_lat, office_lon)
    return (dist <= allowed_radius_meters, dist)
