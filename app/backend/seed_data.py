import json
import logging
import os

from config import (
    FEATURE_DEFINITIONS, INFRA_SLUG_TO_TYPE,
    SEED_DATA_DIR, SEED_INFRA_FILE, SEED_PLOTS_FILE,
)
from database import get_db, get_infra_repo, get_plot_repo

logger = logging.getLogger(__name__)


def _resolve(path: str) -> str | None:
    full = path if os.path.isabs(path) else os.path.join(SEED_DATA_DIR, path)
    return full if os.path.isfile(full) else None


async def _seed_infrastructure() -> None:
    repo = get_infra_repo()
    total = await repo.count_all()
    if total > 0:
        logger.info("infra_objects already has %d docs, skip seed", total)
        return

    path = _resolve(SEED_INFRA_FILE)
    if not path:
        logger.info("Seed infra file %s not found, skip", SEED_INFRA_FILE)
        return

    with open(path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    inserted = 0
    for slug, items in payload.items():
        infra_type = INFRA_SLUG_TO_TYPE.get(slug)
        if not infra_type or not isinstance(items, list):
            continue
        docs = []
        for it in items:
            lat = it.get("lat")
            lon = it.get("lon", it.get("lng"))
            if lat is None or lon is None:
                continue
            doc = {
                "name": it.get("name", ""),
                "location": {"type": "Point", "coordinates": [lon, lat]},
                "type": infra_type,
            }
            if infra_type == "negative" and it.get("type"):
                doc["subtype"] = it["type"]
            docs.append(doc)
        if docs:
            inserted += await repo.insert_many(slug, docs)
    logger.info("Seeded %d infrastructure objects from %s", inserted, path)


async def _seed_plots() -> None:
    plot_repo = get_plot_repo()
    if await plot_repo.count() > 0:
        logger.info("plots already populated, skip seed")
        return

    path = _resolve(SEED_PLOTS_FILE)
    if not path:
        logger.info("Seed plots file %s not found, skip", SEED_PLOTS_FILE)
        return

    with open(path, "r", encoding="utf-8") as fh:
        records = json.load(fh)
    if not isinstance(records, list) or not records:
        logger.info("Seed plots file %s is empty, skip", path)
        return

    from routes.data_io import _build_feature_map, _build_plot_doc, _extract_coordinates
    from services.geo_service import compute_distances
    from services.search_service import invalidate_search_cache

    db = get_db()
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
    logger.info("Seeded %d plots from %s", inserted, path)


async def seed_initial_data() -> None:
    try:
        await _seed_infrastructure()
    except Exception as exc:
        logger.warning("Infrastructure seed failed: %s", exc)
    try:
        await _seed_plots()
    except Exception as exc:
        logger.warning("Plots seed failed: %s", exc)


__all__ = ["seed_initial_data"]
