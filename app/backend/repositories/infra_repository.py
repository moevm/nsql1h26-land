"""
Репозиторий коллекции infra_objects — CRUD и гео-запросы.

Единая коллекция по data_model.md: документы различаются полем `type`
(metro_station, hospital, school, kindergarten, store, pickup_point,
bus_stop, negative). У документов с type="negative" используется также
поле `subtype`.

Внешние slug-идентификаторы (metro_stations, hospitals, ...) переводятся
в type через config.INFRA_SLUG_TO_TYPE.
"""

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from config import COL_INFRA, INFRA_SLUG_TO_TYPE


def _slug_to_type(slug_or_type: str) -> str:
    """Принимает и slug (metro_stations), и raw type (metro_station)."""
    return INFRA_SLUG_TO_TYPE.get(slug_or_type, slug_or_type)


class InfraRepository:
    """Доступ к коллекции infra_objects."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db
        self._col = db[COL_INFRA]

    # ---------- Read ----------

    async def find_all(self, collection: str) -> list[dict]:
        """Документы одного type (collection здесь — slug или type)."""
        t = _slug_to_type(collection)
        cursor = self._col.find({"type": t})
        return await cursor.to_list(length=10000)

    async def find_all_any(self) -> list[dict]:
        cursor = self._col.find({})
        return await cursor.to_list(length=100000)

    async def count(self, collection: str) -> int:
        t = _slug_to_type(collection)
        return await self._col.count_documents({"type": t})

    async def count_all(self) -> int:
        return await self._col.count_documents({})

    # ---------- Geo ----------

    async def find_nearest(self, collection: str, lon: float, lat: float) -> dict | None:
        """Ближайший объект одного type через $geoNear."""
        t = _slug_to_type(collection)
        pipeline = [
            {
                "$geoNear": {
                    "near": {"type": "Point", "coordinates": [lon, lat]},
                    "distanceField": "dist_meters",
                    "spherical": True,
                    "query": {"type": t},
                }
            },
            {"$limit": 1},
            {"$project": {"name": 1, "dist_meters": 1, "type": 1, "subtype": 1}},
        ]
        result = await self._col.aggregate(pipeline).to_list(length=1)
        return result[0] if result else None

    async def find_nearest_per_type(self, lon: float, lat: float) -> dict[str, dict]:
        """
        Одним $geoNear + $group получить ближайший документ каждого type.
        Возвращает {type: {name, dist_meters, subtype?}}.
        (Q3/Q5 из data_model.md.)
        """
        pipeline = [
            {
                "$geoNear": {
                    "near": {"type": "Point", "coordinates": [lon, lat]},
                    "distanceField": "dist_meters",
                    "spherical": True,
                }
            },
            {"$sort": {"type": 1, "dist_meters": 1}},
            {
                "$group": {
                    "_id": "$type",
                    "name": {"$first": "$name"},
                    "dist_meters": {"$first": "$dist_meters"},
                    "subtype": {"$first": "$subtype"},
                }
            },
        ]
        result = await self._col.aggregate(pipeline).to_list(length=None)
        return {doc["_id"]: doc for doc in result}

    # ---------- Create ----------

    async def insert_one(self, collection: str, doc: dict) -> ObjectId:
        """
        Вставка документа. type проставляется из slug коллекции, если
        в самом документе его ещё нет.
        """
        t = _slug_to_type(collection)
        doc = {**doc, "type": doc.get("type", t)}
        result = await self._col.insert_one(doc)
        return result.inserted_id

    async def insert_many(self, collection: str, docs: list[dict]) -> int:
        if not docs:
            return 0
        t = _slug_to_type(collection)
        prepared = [{**d, "type": d.get("type", t)} for d in docs]
        result = await self._col.insert_many(prepared)
        return len(result.inserted_ids)

    # ---------- Delete ----------

    async def delete_one(self, collection: str, oid: ObjectId) -> bool:
        t = _slug_to_type(collection)
        result = await self._col.delete_one({"_id": oid, "type": t})
        return result.deleted_count > 0

    async def delete_all(self, collection: str) -> int:
        """Очищает документы одного type."""
        t = _slug_to_type(collection)
        result = await self._col.delete_many({"type": t})
        return result.deleted_count

    # ---------- Replace ----------

    async def replace_all(self, collection: str, docs: list[dict]) -> int:
        """Заменить все документы одного type."""
        t = _slug_to_type(collection)
        await self._col.delete_many({"type": t})
        if not docs:
            return 0
        prepared = [{**d, "type": d.get("type", t)} for d in docs]
        result = await self._col.insert_many(prepared)
        return len(result.inserted_ids)
