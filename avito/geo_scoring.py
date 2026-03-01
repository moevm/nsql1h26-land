"""
Расчёт географических расстояний до инфраструктуры и негативных факторов.
Использует geopy для вычисления расстояний по координатам.
"""

from geopy.distance import geodesic
from config import (
    METRO_STATIONS, HOSPITALS, SCHOOLS,
    NEGATIVE_FACTORS,
    INFRA_MAX_DISTANCE_KM,
    NEGATIVE_MIN_DISTANCE_KM, NEGATIVE_MAX_DISTANCE_KM,
)


def _min_distance(lat: float, lon: float, points: dict[str, tuple]) -> tuple[float, str]:
    """
    Возвращает (расстояние_км, название) до ближайшей точки из словаря.
    """
    best_dist = float("inf")
    best_name = ""
    for name, (plat, plon) in points.items():
        d = geodesic((lat, lon), (plat, plon)).km
        if d < best_dist:
            best_dist = d
            best_name = name
    return round(best_dist, 2), best_name


def compute_geo_distances(record: dict) -> dict:
    """
    Рассчитывает расстояния до ближайших объектов.
    Добавляет поля:
        nearest_metro_km, nearest_metro_name,
        nearest_hospital_km, nearest_hospital_name,
        nearest_school_km, nearest_school_name,
        nearest_negative_km, nearest_negative_name,
    """
    lat, lon = record["lat"], record["lon"]

    metro_km, metro_name = _min_distance(lat, lon, METRO_STATIONS)
    hosp_km, hosp_name = _min_distance(lat, lon, HOSPITALS)
    school_km, school_name = _min_distance(lat, lon, SCHOOLS)
    neg_km, neg_name = _min_distance(lat, lon, NEGATIVE_FACTORS)

    record["nearest_metro_km"] = metro_km
    record["nearest_metro_name"] = metro_name
    record["nearest_hospital_km"] = hosp_km
    record["nearest_hospital_name"] = hosp_name
    record["nearest_school_km"] = school_km
    record["nearest_school_name"] = school_name
    record["nearest_negative_km"] = neg_km
    record["nearest_negative_name"] = neg_name

    return record


def compute_infra_score(record: dict) -> float:
    """
    Нормализованный score инфраструктуры: 0..1 (больше = лучше).
    Среднее по 1/(1 + dist) для каждого типа инфраструктуры.
    """
    metro = min(record.get("nearest_metro_km", INFRA_MAX_DISTANCE_KM), INFRA_MAX_DISTANCE_KM)
    hosp = min(record.get("nearest_hospital_km", INFRA_MAX_DISTANCE_KM), INFRA_MAX_DISTANCE_KM)
    school = min(record.get("nearest_school_km", INFRA_MAX_DISTANCE_KM), INFRA_MAX_DISTANCE_KM)

    # Веса: метро важнее
    w_metro, w_hosp, w_school = 0.5, 0.25, 0.25

    score = (
        w_metro * (1.0 / (1.0 + metro)) +
        w_hosp * (1.0 / (1.0 + hosp)) +
        w_school * (1.0 / (1.0 + school))
    )
    return round(score, 4)


def compute_negative_score(record: dict) -> float:
    """
    Нормализованный score негативных факторов: 0..1 (больше = лучше, т.е. дальше от негатива).
    """
    neg_km = record.get("nearest_negative_km", NEGATIVE_MAX_DISTANCE_KM)
    neg_km = max(neg_km, NEGATIVE_MIN_DISTANCE_KM)
    neg_km = min(neg_km, NEGATIVE_MAX_DISTANCE_KM)

    # Линейная нормализация: 0.5km → 0.0, 20km → 1.0
    score = (neg_km - NEGATIVE_MIN_DISTANCE_KM) / (NEGATIVE_MAX_DISTANCE_KM - NEGATIVE_MIN_DISTANCE_KM)
    return round(score, 4)


def enrich_with_geo(records: list[dict]) -> list[dict]:
    """Рассчитывает geo-расстояния для всех записей in-place."""
    for rec in records:
        compute_geo_distances(rec)
        rec["infra_score"] = compute_infra_score(rec)
        rec["negative_score"] = compute_negative_score(rec)
    return records
