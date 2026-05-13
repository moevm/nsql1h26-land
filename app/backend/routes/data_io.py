import asyncio
import logging
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from database import get_db, get_plot_repo, get_infra_repo
from auth import require_admin
from config import (
    COL_PLOTS, INFRA_SLUGS,
)
from services.feature_service import extract_features_batch
from services.geo_service import compute_distances, compute_total_score, recalculate_all_scores
from services.search_service import invalidate_search_cache
from config import FEATURE_DEFINITIONS
from utils import serialize_doc_deep as _serialize_doc, parse_area

router = APIRouter(prefix="/api/data", tags=["data-io"])

logger = logging.getLogger(__name__)

ALL_COLLECTIONS = [COL_PLOTS] + list(INFRA_SLUGS)
_BACKGROUND_TASKS: set[asyncio.Task[Any]] = set()


def _schedule_background_task(coro: Any) -> None:
    task = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)


def _trigger_recalc() -> None:
    db = get_db()

    async def _run() -> None:
        try:
            updated = await recalculate_all_scores(db)
            logger.info("Recalculated scores for %d plots after infra import/clear", updated)
        except Exception as exc:
            logger.warning("Failed to recalculate scores after infra import/clear: %s", exc)

    _schedule_background_task(_run())


def _record_has_nested_features(rec: dict) -> bool:
    return isinstance(rec.get("features"), dict) and rec.get("feature_score") is not None


def _record_has_flat_features(rec: dict, feature_keys: list[str]) -> bool:
    return (
        rec.get("feature_score") is not None
        and any(rec.get(key) is not None for key in feature_keys)
    )


def _partition_records_by_features(
    records: list[dict],
    feature_keys: list[str],
) -> tuple[list[int], list[int], list[int]]:
    need_features_idx: list[int] = []
    have_nested_features_idx: list[int] = []
    have_flat_features_idx: list[int] = []

    for index, rec in enumerate(records):
        if _record_has_nested_features(rec):
            have_nested_features_idx.append(index)
        elif _record_has_flat_features(rec, feature_keys):
            have_flat_features_idx.append(index)
        else:
            need_features_idx.append(index)

    return need_features_idx, have_nested_features_idx, have_flat_features_idx


def _build_feature_map(records: list[dict], feature_keys: list[str]) -> dict[int, dict[str, Any]]:
    need_idx, nested_idx, flat_idx = _partition_records_by_features(records, feature_keys)
    feat_map: dict[int, dict[str, Any]] = {}

    if need_idx:
        computed = extract_features_batch([records[i] for i in need_idx])
        for j, rec_idx in enumerate(need_idx):
            feat_map[rec_idx] = computed[j]

    for rec_idx in nested_idx:
        rec = records[rec_idx]
        feat_map[rec_idx] = {
            "features": rec["features"],
            "feature_score": rec["feature_score"],
            "features_text": rec.get("features_text", ""),
        }

    for rec_idx in flat_idx:
        rec = records[rec_idx]
        feat_map[rec_idx] = {
            "features": {key: rec.get(key, 0.0) for key in feature_keys},
            "feature_score": rec["feature_score"],
            "features_text": rec.get("features_text", ""),
        }

    return feat_map


def _extract_coordinates(rec: dict) -> tuple[float, float] | None:
    lat = rec.get("lat", 0)
    lon = rec.get("lon", rec.get("lng", 0))
    if not lat or not lon:
        return None
    return lat, lon


def _build_price_history(rec: dict, price: Any) -> list[dict]:
    existing = rec.get("price_history")
    if existing:
        return existing
    if price is None:
        return []
    return [{"price": price, "at": datetime.now(timezone.utc)}]


def _build_plot_doc(rec: dict, feat: dict[str, Any], geo_data: dict, lat: float, lon: float) -> dict:
    area = rec.get("area_sotki")
    if not area:
        area = parse_area(rec.get("title", ""), rec.get("description", ""))

    price = rec.get("price", 0)
    price_per_sotka = rec.get("price_per_sotka")
    if not price_per_sotka and price and area and area > 0:
        price_per_sotka = round(price / area, 2)

    total_score = compute_total_score(
        infra_score=geo_data["infra_score"],
        negative_score=geo_data["negative_score"],
        feature_score=feat["feature_score"],
        price_per_sotka=price_per_sotka,
    )

    return {
        "avito_id": rec.get("avito_id", rec.get("id")),
        "title": rec.get("title", ""),
        "description": rec.get("description", ""),
        "price": price,
        "area_sotki": area,
        "price_per_sotka": price_per_sotka,
        "location": rec.get("location", rec.get("locationName", "")),
        "address": rec.get("address", rec.get("addressFull", "")),
        "geo_ref": rec.get("geo_ref", rec.get("geoReferences", "")),
        "geo_location": {"type": "Point", "coordinates": [lon, lat]},
        "url": rec.get("url", ""),
        "thumbnail": rec.get("thumbnail", ""),
        "images_count": rec.get("images_count", rec.get("imagesCount", 0)),
        "was_lowered": rec.get("was_lowered", rec.get("wasLowered", False)),
        "features": feat["features"],
        "feature_score": feat["feature_score"],
        "features_text": feat.get("features_text", ""),
        "infra_score": geo_data["infra_score"],
        "negative_score": geo_data["negative_score"],
        "total_score": total_score,
        "created_at": datetime.now(timezone.utc),
        "price_history": _build_price_history(rec, price),
    }

@router.get("/export")
async def export_all(_: Annotated[dict, Depends(require_admin)]):
    plot_repo = get_plot_repo()
    infra_repo = get_infra_repo()
    result = {}
    docs = await plot_repo.find_all()
    result[COL_PLOTS] = [_serialize_doc(d) for d in docs]
    for col_name in INFRA_SLUGS:
        docs = await infra_repo.find_all(col_name)
        result[col_name] = [_serialize_doc(d) for d in docs]
    return JSONResponse(content=jsonable_encoder(result))


@router.get(
    "/export/{collection}",
    responses={400: {"description": "Unknown collection"}},
)
async def export_collection(
    collection: str,
    _: Annotated[dict, Depends(require_admin)],
):
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    if collection == COL_PLOTS:
        repo = get_plot_repo()
        docs = await repo.find_all()
    else:
        repo = get_infra_repo()
        docs = await repo.find_all(collection)
    return JSONResponse(content=jsonable_encoder({
        "collection": collection,
        "count": len(docs),
        "data": [_serialize_doc(d) for d in docs],
    }))

@router.post("/import/plots")
async def import_plots(
    records: list[dict],
    _: Annotated[dict, Depends(require_admin)],
):
    db = get_db()
    plot_repo = get_plot_repo()

    if not records:
        return {"inserted": 0}

    feature_keys = list(FEATURE_DEFINITIONS.keys())
    feat_map = _build_feature_map(records, feature_keys)

    inserted = 0
    for idx, rec in enumerate(records):
        coords = _extract_coordinates(rec)
        if coords is None:
            continue
        lat, lon = coords
        feat = feat_map[idx]

        geo_data = await compute_distances(db, lat, lon)
        doc = _build_plot_doc(rec, feat, geo_data, lat, lon)

        if doc.get("avito_id"):
            await plot_repo.upsert_by_avito_id(doc["avito_id"], doc)
        else:
            await plot_repo.insert_one(doc)
        inserted += 1

    if inserted:
        invalidate_search_cache()

    return {"inserted": inserted}


@router.delete(
    "/clear/{collection}",
    responses={400: {"description": "Unknown collection"}},
)
async def clear_collection(
    collection: str,
    _: Annotated[dict, Depends(require_admin)],
):
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    if collection == COL_PLOTS:
        repo = get_plot_repo()
        deleted = await repo.delete_all()
        if deleted:
            invalidate_search_cache()
    else:
        repo = get_infra_repo()
        deleted = await repo.delete_all(collection)
        _trigger_recalc()
    return {"deleted": deleted, "collection": collection}


@router.get("/stats")
async def get_stats():
    plot_repo = get_plot_repo()
    infra_repo = get_infra_repo()
    stats = {}
    stats[COL_PLOTS] = await plot_repo.count()
    for col_name in INFRA_SLUGS:
        stats[col_name] = await infra_repo.count(col_name)
    return stats
