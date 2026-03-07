"""
Маршруты управления инфраструктурными коллекциями.
"""

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from config import INFRA_COLLECTIONS, COL_NEGATIVE
from models import InfraObjectCreate, InfraObjectOut
from auth import require_admin

router = APIRouter(prefix="/api/infra", tags=["infrastructure"])

ALL_COLLECTIONS = INFRA_COLLECTIONS + [COL_NEGATIVE]


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    coords = doc.get("location", {}).get("coordinates", [0, 0])
    doc["lon"] = coords[0] if len(coords) > 0 else 0
    doc["lat"] = coords[1] if len(coords) > 1 else 0
    return doc


@router.get("/collections")
async def list_collections():
    """Список доступных инфра-коллекций."""
    return {"collections": ALL_COLLECTIONS}


@router.get("/{collection}", response_model=list[InfraObjectOut])
async def list_objects(collection: str):
    """Список объектов в коллекции."""
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    db = get_db()
    cursor = db[collection].find({})
    docs = await cursor.to_list(length=1000)
    return [InfraObjectOut(**_serialize(d)) for d in docs]


@router.post("/{collection}", response_model=InfraObjectOut, status_code=201)
async def add_object(collection: str, data: InfraObjectCreate, _: dict = Depends(require_admin)):
    """Добавить объект инфраструктуры."""
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    db = get_db()
    doc = {
        "name": data.name,
        "location": {"type": "Point", "coordinates": [data.lon, data.lat]},
    }
    if data.type and collection == COL_NEGATIVE:
        doc["type"] = data.type

    result = await db[collection].insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["lat"] = data.lat
    doc["lon"] = data.lon
    return InfraObjectOut(**doc)


@router.delete("/{collection}/{object_id}", status_code=204)
async def delete_object(collection: str, object_id: str, _: dict = Depends(require_admin)):
    """Удалить объект инфраструктуры."""
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    db = get_db()
    try:
        oid = ObjectId(object_id)
    except Exception:
        raise HTTPException(404, "Invalid ID")
    result = await db[collection].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(404, "Object not found")


@router.put("/{collection}", status_code=200)
async def replace_collection(collection: str, data: list[InfraObjectCreate], _: dict = Depends(require_admin)):
    """
    Полностью перезаписать коллекцию инфраструктуры.
    Удаляет все текущие документы и вставляет новые.
    """
    if collection not in ALL_COLLECTIONS:
        raise HTTPException(400, f"Unknown collection: {collection}")
    db = get_db()

    await db[collection].delete_many({})

    if data:
        docs = []
        for item in data:
            doc = {
                "name": item.name,
                "location": {"type": "Point", "coordinates": [item.lon, item.lat]},
            }
            if item.type and collection == COL_NEGATIVE:
                doc["type"] = item.type
            docs.append(doc)
        await db[collection].insert_many(docs)

    return {"replaced": len(data), "collection": collection}
