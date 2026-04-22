import asyncio
import logging
from typing import Annotated, Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from database import get_db, get_infra_repo
from config import INFRA_SLUGS, COL_NEGATIVE
from models import InfraObjectCreate, InfraObjectOut
from auth import require_admin
from services.geo_service import recalculate_all_scores

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/infra", tags=["infrastructure"])

ALL_COLLECTIONS = list(INFRA_SLUGS)
_BACKGROUND_TASKS: set[asyncio.Task[Any]] = set()


def _schedule_background_task(coro: Any) -> None:
    task = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    coords = doc.get("location", {}).get("coordinates", [0, 0])
    doc["lon"] = coords[0] if len(coords) > 0 else 0
    doc["lat"] = coords[1] if len(coords) > 1 else 0
    doc["type"] = doc.get("subtype")
    return doc


def _trigger_recalc() -> None:
    db = get_db()

    async def _run() -> None:
        try:
            updated = await recalculate_all_scores(db)
            logger.info("Recalculated scores for %d plots after infra update", updated)
        except Exception as exc:
            logger.warning("Failed to recalculate scores after infra update: %s", exc)

    _schedule_background_task(_run())


@router.get("/collections")
async def list_collections():
    return {"collections": ALL_COLLECTIONS}


@router.get(
    "/{collection}",
    response_model=list[InfraObjectOut],
    responses={400: {"description": "Unknown collection"}},
)
async def list_objects(collection: str):
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    repo = get_infra_repo()
    docs = await repo.find_all(collection)
    return [InfraObjectOut(**_serialize(d)) for d in docs]


@router.post(
    "/{collection}",
    response_model=InfraObjectOut,
    status_code=201,
    responses={400: {"description": "Unknown collection"}},
)
async def add_object(
    collection: str,
    data: InfraObjectCreate,
    _: Annotated[dict, Depends(require_admin)],
):
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    repo = get_infra_repo()
    doc = {
        "name": data.name,
        "location": {"type": "Point", "coordinates": [data.lon, data.lat]},
    }
    if data.type and collection == COL_NEGATIVE:
        doc["subtype"] = data.type

    inserted_id = await repo.insert_one(collection, doc)
    out = _serialize({**doc, "_id": inserted_id})
    _trigger_recalc()
    return InfraObjectOut(**out)


@router.delete(
    "/{collection}/{object_id}",
    status_code=204,
    responses={
        400: {"description": "Unknown collection"},
        404: {"description": "Invalid ID or object not found"},
    },
)
async def delete_object(
    collection: str,
    object_id: str,
    _: Annotated[dict, Depends(require_admin)],
):
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    repo = get_infra_repo()
    try:
        oid = ObjectId(object_id)
    except Exception:
        raise HTTPException(404, "Invalid ID")
    deleted = await repo.delete_one(collection, oid)
    if not deleted:
        raise HTTPException(404, "Object not found")
    _trigger_recalc()


@router.put(
    "/{collection}",
    status_code=200,
    responses={400: {"description": "Unknown collection"}},
)
async def replace_collection(
    collection: str,
    data: list[InfraObjectCreate],
    _: Annotated[dict, Depends(require_admin)],
):
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    repo = get_infra_repo()

    docs = []
    for item in data:
        doc = {
            "name": item.name,
            "location": {"type": "Point", "coordinates": [item.lon, item.lat]},
        }
        if item.type and collection == COL_NEGATIVE:
            doc["subtype"] = item.type
        docs.append(doc)

    count = await repo.replace_all(collection, docs)
    _trigger_recalc()
    return {"replaced": count, "collection": collection}
