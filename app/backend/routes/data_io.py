"""
Маршруты импорта/экспорта данных.
"""

import re
import math
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from database import get_db
from config import (
    COL_PLOTS, INFRA_COLLECTIONS, COL_NEGATIVE,
)
from services.feature_service import extract_features_batch
from services.geo_service import compute_distances, compute_total_score
from config import EMBEDDING_DIM, FEATURE_DEFINITIONS

router = APIRouter(prefix="/api/data", tags=["data-io"])

ALL_COLLECTIONS = [COL_PLOTS] + INFRA_COLLECTIONS + [COL_NEGATIVE]


def _serialize_doc(doc: dict) -> dict:
    """Конвертирует MongoDB-документ в JSON-сериализуемый dict."""
    for key, value in list(doc.items()):
        if isinstance(value, ObjectId):
            doc[key] = str(value)
        elif isinstance(value, datetime):
            doc[key] = value.isoformat()
        elif isinstance(value, dict):
            doc[key] = _serialize_doc(value)
    return doc


# ---------- Экспорт ----------

@router.get("/export")
async def export_all():
    """Экспорт ВСЕХ коллекций в JSON."""
    db = get_db()
    result = {}
    for col_name in ALL_COLLECTIONS:
        cursor = db[col_name].find({})
        docs = await cursor.to_list(length=None)
        result[col_name] = [_serialize_doc(d) for d in docs]
    return JSONResponse(content=result)


@router.get("/export/{collection}")
async def export_collection(collection: str):
    """Экспорт одной коллекции в JSON."""
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    db = get_db()
    cursor = db[collection].find({})
    docs = await cursor.to_list(length=None)
    return JSONResponse(content={
        "collection": collection,
        "count": len(docs),
        "data": [_serialize_doc(d) for d in docs],
    })


# ---------- Импорт ----------

@router.post("/import/plots")
async def import_plots(records: list[dict]):
    """
    Импорт объявлений.
    Если в записи уже есть features/embedding — используем их.
    Если нет — рассчитываем автоматически.
    """
    db = get_db()

    if not records:
        return {"inserted": 0}

    # Имена фич из конфига
    _feat_keys = list(FEATURE_DEFINITIONS.keys())

    def _has_nested_features(rec: dict) -> bool:
        """Запись с вложенным dict `features` (формат БД)."""
        return (
            isinstance(rec.get("features"), dict)
            and rec.get("feature_score") is not None
        )

    def _has_flat_features(rec: dict) -> bool:
        """Запись с плоскими полями фич (формат enriched_cache.json из пайплайна)."""
        return (
            rec.get("feature_score") is not None
            and any(rec.get(k) is not None for k in _feat_keys)
        )

    # Разделяем: записи С фичами и БЕЗ
    need_features_idx = []
    have_features_idx = []
    have_flat_features_idx = []
    for i, rec in enumerate(records):
        if _has_nested_features(rec):
            have_features_idx.append(i)
        elif _has_flat_features(rec):
            have_flat_features_idx.append(i)
        else:
            need_features_idx.append(i)

    # Считаем фичи только для тех, у кого их нет
    feat_map: dict[int, dict] = {}
    if need_features_idx:
        recs_to_compute = [records[i] for i in need_features_idx]
        computed = extract_features_batch(recs_to_compute)
        for j, idx in enumerate(need_features_idx):
            feat_map[idx] = computed[j]

    # Для тех, у кого фичи вложенным словарём — берём как есть
    for idx in have_features_idx:
        rec = records[idx]
        feat_map[idx] = {
            "features": rec["features"],
            "feature_score": rec["feature_score"],
            "features_text": rec.get("features_text", ""),
            "embedding": rec.get("embedding", [0.0] * EMBEDDING_DIM),
        }

    # Для тех, у кого фичи плоскими полями (enriched_cache.json) — собираем dict
    for idx in have_flat_features_idx:
        rec = records[idx]
        features_dict = {k: rec.get(k, 0.0) for k in _feat_keys}
        feat_map[idx] = {
            "features": features_dict,
            "feature_score": rec["feature_score"],
            "features_text": rec.get("features_text", ""),
            "embedding": rec.get("embedding", [0.0] * EMBEDDING_DIM),
        }

    inserted = 0
    for i, rec in enumerate(records):
        feat = feat_map[i]

        lat = rec.get("lat", 0)
        lon = rec.get("lon", rec.get("lng", 0))
        if not lat or not lon:
            continue

        area = rec.get("area_sotki")
        if not area:
            for text in [rec.get("title", ""), rec.get("description", "")]:
                m = re.search(r"(\d+[.,]?\d*)\s*сот", text, re.IGNORECASE)
                if m:
                    area = float(m.group(1).replace(",", "."))
                    break

        price = rec.get("price", 0)
        price_per_sotka = rec.get("price_per_sotka")
        if not price_per_sotka and price and area and area > 0:
            price_per_sotka = round(price / area, 2)

        geo_data = await compute_distances(db, lat, lon)

        total_score = compute_total_score(
            infra_score=geo_data["infra_score"],
            negative_score=geo_data["negative_score"],
            feature_score=feat["feature_score"],
            price_per_sotka=price_per_sotka,
        )

        doc = {
            "avito_id": rec.get("avito_id", rec.get("id")),
            "title": rec.get("title", ""),
            "description": rec.get("description", ""),
            "price": price,
            "area_sotki": area,
            "price_per_sotka": price_per_sotka,
            "location": rec.get("location", rec.get("locationName", "")),
            "address": rec.get("address", rec.get("addressFull", "")),
            "geo_ref": rec.get("geo_ref", rec.get("geoReferences", "")),
            "lat": lat,
            "lon": lon,
            "geo_location": {"type": "Point", "coordinates": [lon, lat]},
            "url": rec.get("url", ""),
            "thumbnail": rec.get("thumbnail", ""),
            "images_count": rec.get("images_count", rec.get("imagesCount", 0)),
            "was_lowered": rec.get("was_lowered", rec.get("wasLowered", False)),
            "embedding": feat["embedding"],
            "features": feat["features"],
            "feature_score": feat["feature_score"],
            "features_text": feat["features_text"],
            "distances": geo_data["distances"],
            "infra_score": geo_data["infra_score"],
            "negative_score": geo_data["negative_score"],
            "total_score": total_score,
            "created_at": datetime.now(timezone.utc),
        }

        # upsert по avito_id если есть
        if doc.get("avito_id"):
            await db[COL_PLOTS].update_one(
                {"avito_id": doc["avito_id"]},
                {"$set": doc},
                upsert=True,
            )
        else:
            await db[COL_PLOTS].insert_one(doc)
        inserted += 1

    return {"inserted": inserted}


@router.post("/import/infra/{collection}")
async def import_infra(collection: str, records: list[dict]):
    """
    Импорт инфраструктурных объектов.
    Полностью заменяет коллекцию.
    """
    all_cols = INFRA_COLLECTIONS + [COL_NEGATIVE]
    if collection not in all_cols:
        raise HTTPException(400, f"Unknown collection: {collection}")

    db = get_db()
    await db[collection].delete_many({})

    if not records:
        return {"inserted": 0, "collection": collection}

    docs = []
    for rec in records:
        lat = rec.get("lat", 0)
        lon = rec.get("lon", rec.get("lng", 0))
        doc = {
            "name": rec.get("name", ""),
            "location": {"type": "Point", "coordinates": [lon, lat]},
        }
        if rec.get("type"):
            doc["type"] = rec["type"]
        docs.append(doc)

    await db[collection].insert_many(docs)
    return {"inserted": len(docs), "collection": collection}


@router.delete("/clear/{collection}")
async def clear_collection(collection: str):
    """Очистить коллекцию."""
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    db = get_db()
    result = await db[collection].delete_many({})
    return {"deleted": result.deleted_count, "collection": collection}


@router.get("/stats")
async def get_stats():
    """Статистика по всем коллекциям."""
    db = get_db()
    stats = {}
    for col_name in ALL_COLLECTIONS:
        count = await db[col_name].count_documents({})
        stats[col_name] = count
    return stats
