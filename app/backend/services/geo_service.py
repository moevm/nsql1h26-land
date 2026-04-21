"""
Гео-сервис: расчёт расстояний до инфраструктуры через MongoDB $geoNear.

Использует 2dsphere индексы на коллекциях инфраструктуры.
Работает через InfraRepository.
"""

import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
from repositories.infra_repository import InfraRepository
from config import (
    COL_PLOTS,
    INFRA_MAX_DISTANCE_KM,
    NEGATIVE_MIN_DISTANCE_KM, NEGATIVE_MAX_DISTANCE_KM,
    WEIGHTS,
)

logger = logging.getLogger(__name__)

# BSON type → ключ в distances (по data_model.md)
_TYPE_TO_DIST_KEY = {
    "metro_station":  "nearest_metro",
    "hospital":       "nearest_hospital",
    "school":         "nearest_school",
    "kindergarten":   "nearest_kindergarten",
    "store":          "nearest_store",
    "pickup_point":   "nearest_pickup_point",
    "bus_stop":       "nearest_bus_stop",
    "negative":       "nearest_negative",
}

# Веса для расчёта infra_score
_INFRA_WEIGHTS = {
    "nearest_metro":         0.25,
    "nearest_hospital":      0.15,
    "nearest_school":        0.15,
    "nearest_kindergarten":  0.10,
    "nearest_store":         0.15,
    "nearest_pickup_point":  0.10,
    "nearest_bus_stop":      0.10,
}


async def compute_distances(db: AsyncIOMotorDatabase, lat: float, lon: float) -> dict:
    """
    Один $geoNear к infra_objects + $group by type — получает ближайший
    объект каждого type. Возвращает distances + скоры.

    (Q3/Q5 из data_model.md.)
    """
    repo = InfraRepository(db)
    nearest_by_type = await repo.find_nearest_per_type(lon, lat)

    distances: dict[str, dict] = {}
    for bson_type, dist_key in _TYPE_TO_DIST_KEY.items():
        doc = nearest_by_type.get(bson_type)
        if doc:
            distances[dist_key] = {
                "name": doc.get("name", ""),
                "km": round(doc["dist_meters"] / 1000.0, 2),
            }
        else:
            distances[dist_key] = {"name": "", "km": INFRA_MAX_DISTANCE_KM}

    # infra_score
    infra_score = 0.0
    for dist_key, weight in _INFRA_WEIGHTS.items():
        km = min(distances.get(dist_key, {}).get("km", INFRA_MAX_DISTANCE_KM), INFRA_MAX_DISTANCE_KM)
        infra_score += weight * (1.0 / (1.0 + km))
    infra_score = round(infra_score, 4)

    # negative_score (больше = лучше = дальше от негатива)
    neg_km = distances.get("nearest_negative", {}).get("km", NEGATIVE_MAX_DISTANCE_KM)
    neg_km = max(neg_km, NEGATIVE_MIN_DISTANCE_KM)
    neg_km = min(neg_km, NEGATIVE_MAX_DISTANCE_KM)
    negative_score = round(
        (neg_km - NEGATIVE_MIN_DISTANCE_KM) / (NEGATIVE_MAX_DISTANCE_KM - NEGATIVE_MIN_DISTANCE_KM),
        4,
    )

    return {
        "distances": distances,
        "infra_score": infra_score,
        "negative_score": negative_score,
    }


async def recalculate_all_scores(db: AsyncIOMotorDatabase) -> int:
    """
    Пересчитывает infra_score, negative_score и total_score для ВСЕХ участков.
    Вызывается в фоне при изменении инфраструктурных коллекций.
    """
    cursor = db[COL_PLOTS].find({}, {"geo_location": 1, "feature_score": 1, "price_per_sotka": 1})
    updated = 0
    async for doc in cursor:
        geo = doc.get("geo_location")
        if not geo or "coordinates" not in geo:
            continue
        coords = geo["coordinates"]
        lon, lat = coords[0], coords[1]
        try:
            geo_data = await compute_distances(db, lat, lon)
            total = compute_total_score(
                infra_score=geo_data["infra_score"],
                negative_score=geo_data["negative_score"],
                feature_score=doc.get("feature_score", 0),
                price_per_sotka=doc.get("price_per_sotka"),
            )
            await db[COL_PLOTS].update_one(
                {"_id": doc["_id"]},
                {"$set": {
                    "infra_score": geo_data["infra_score"],
                    "negative_score": geo_data["negative_score"],
                    "total_score": total,
                }},
            )
            updated += 1
        except Exception as exc:
            logger.warning("recalculate_all_scores: skip %s — %s", doc["_id"], exc)
    logger.info("recalculate_all_scores: updated %d plots", updated)
    return updated


def compute_total_score(
    infra_score: float,
    negative_score: float,
    feature_score: float,
    price_per_sotka: float | None,
    all_prices: list[float] | None = None,
) -> float:
    """
    Рассчитывает total_score для одного объявления.
    Если all_prices не передан — price_norm считается как 0.5.
    """
    price_norm = 0.5
    if price_per_sotka and all_prices and len(all_prices) > 1:
        mn = min(all_prices)
        mx = max(all_prices)
        if mx - mn > 1e-9:
            price_norm = 1.0 - (price_per_sotka - mn) / (mx - mn)

    total = (
        WEIGHTS["infra"] * infra_score +
        WEIGHTS["negative"] * negative_score +
        WEIGHTS["features"] * feature_score +
        WEIGHTS["price"] * price_norm
    )
    return round(total, 4)
