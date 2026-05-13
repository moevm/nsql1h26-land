from __future__ import annotations

from domain.value_objects import GeoScoreResult

_TYPE_TO_DIST_KEY = {
    "metro_station": "nearest_metro",
    "hospital": "nearest_hospital",
    "school": "nearest_school",
    "kindergarten": "nearest_kindergarten",
    "store": "nearest_store",
    "pickup_point": "nearest_pickup_point",
    "bus_stop": "nearest_bus_stop",
    "negative": "nearest_negative",
}

_INFRA_WEIGHTS = {
    "nearest_metro": 0.25,
    "nearest_hospital": 0.15,
    "nearest_school": 0.15,
    "nearest_kindergarten": 0.10,
    "nearest_store": 0.15,
    "nearest_pickup_point": 0.10,
    "nearest_bus_stop": 0.10,
}

_SCORE_WEIGHTS = {"infra": 0.35, "negative": 0.25, "features": 0.25, "price": 0.15}


def compute_infra_score(distances: dict[str, dict], max_distance_km: float = 50.0) -> float:
    score = 0.0
    for dist_key, weight in _INFRA_WEIGHTS.items():
        km = min(distances.get(dist_key, {}).get("km", max_distance_km), max_distance_km)
        score += weight * (1.0 / (1.0 + km))
    return round(score, 4)


def compute_negative_score(
    distances: dict[str, dict],
    min_km: float = 0.5,
    max_km: float = 20.0,
) -> float:
    neg_km = distances.get("nearest_negative", {}).get("km", max_km)
    neg_km = max(neg_km, min_km)
    neg_km = min(neg_km, max_km)
    return round((neg_km - min_km) / (max_km - min_km), 4)


def compute_total_score(
    infra_score: float,
    negative_score: float,
    feature_score: float,
    price_per_sotka: float | None = None,
    all_prices: list[float] | None = None,
) -> float:
    price_norm = 0.5
    if price_per_sotka and all_prices and len(all_prices) > 1:
        mn = min(all_prices)
        mx = max(all_prices)
        if mx - mn > 1e-9:
            price_norm = 1.0 - (price_per_sotka - mn) / (mx - mn)

    total = (
        _SCORE_WEIGHTS["infra"] * infra_score
        + _SCORE_WEIGHTS["negative"] * negative_score
        + _SCORE_WEIGHTS["features"] * feature_score
        + _SCORE_WEIGHTS["price"] * price_norm
    )
    return round(total, 4)


def build_distances_map(nearest_by_type: dict[str, dict], max_distance_km: float = 50.0) -> dict[str, dict]:
    distances: dict[str, dict] = {}
    for bson_type, dist_key in _TYPE_TO_DIST_KEY.items():
        doc = nearest_by_type.get(bson_type)
        if doc:
            distances[dist_key] = {
                "name": doc.get("name", ""),
                "km": round(doc["dist_meters"] / 1000.0, 2),
            }
        else:
            distances[dist_key] = {"name": "", "km": max_distance_km}
    return distances


def compute_geo_score(distances: dict[str, dict], max_distance_km: float = 50.0) -> GeoScoreResult:
    return GeoScoreResult(
        distances=distances,
        infra_score=compute_infra_score(distances, max_distance_km),
        negative_score=compute_negative_score(distances),
    )
