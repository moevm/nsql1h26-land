"""
Репозиторий коллекции plots — CRUD и поисковые операции.
"""

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from config import COL_PLOTS


class PlotRepository:
    """Абстракция доступа к коллекции plots."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self._col = db[COL_PLOTS]

    # ---------- Read ----------

    async def count(self, query_filter: dict | None = None) -> int:
        return await self._col.count_documents(query_filter or {})

    async def find_page(
        self,
        query_filter: dict | None = None,
        sort_field: str = "created_at",
        sort_dir: int = -1,
        sort_fields: list[tuple[str, int]] | None = None,
        skip: int = 0,
        limit: int = 20,
        projection: dict | None = None,
    ) -> list[dict]:
        cursor = self._col.find(query_filter or {}, projection)
        if sort_fields:
            cursor = cursor.sort(sort_fields)
        else:
            cursor = cursor.sort(sort_field, sort_dir)

        cursor = cursor.skip(skip).limit(limit)
        return await cursor.to_list(length=limit)

    async def find_by_id(self, oid: ObjectId, projection: dict | None = None) -> dict | None:
        return await self._col.find_one({"_id": oid}, projection)

    async def find_all(
        self,
        query_filter: dict | None = None,
        projection: dict | None = None,
    ) -> list[dict]:
        cursor = self._col.find(query_filter or {}, projection)
        return await cursor.to_list(length=None)

    async def suggest_locations(self, query: str, limit: int = 20) -> list[str]:
        """
        Возвращает уникальные непустые значения поля `location`, подходящие
        под подстроку запроса (регистронезависимо). Пустой запрос — все
        населённые пункты (в пределах limit), отсортированные по алфавиту.
        """
        import re
        location_cond: dict = {"$nin": [None, ""]}
        trimmed = (query or "").strip()
        if trimmed:
            location_cond = {"$regex": re.escape(trimmed), "$options": "i"}
        pipeline = [
            {"$match": {"location": location_cond}},
            {"$group": {"_id": "$location"}},
            {"$match": {"_id": {"$nin": [None, ""]}}},
            {"$sort": {"_id": 1}},
            {"$limit": max(1, limit)},
        ]
        cursor = self._col.aggregate(pipeline)
        return [doc["_id"] async for doc in cursor if doc.get("_id")]

    # ---------- Create ----------

    async def insert_one(self, doc: dict) -> ObjectId:
        result = await self._col.insert_one(doc)
        return result.inserted_id

    # ---------- Update ----------

    async def update_one(self, oid: ObjectId, updates: dict) -> bool:
        result = await self._col.update_one({"_id": oid}, {"$set": updates})
        return result.modified_count > 0

    async def upsert_by_avito_id(self, avito_id: int, doc: dict) -> None:
        await self._col.update_one(
            {"avito_id": avito_id},
            {"$set": doc},
            upsert=True,
        )

    # ---------- Delete ----------

    async def delete_one(self, oid: ObjectId) -> bool:
        result = await self._col.delete_one({"_id": oid})
        return result.deleted_count > 0

    async def delete_all(self) -> int:
        result = await self._col.delete_many({})
        return result.deleted_count

    async def find_by_ids(
        self,
        ids: list[ObjectId],
        projection: dict | None = None,
    ) -> list[dict]:
        cursor = self._col.find({"_id": {"$in": ids}}, projection)
        return await cursor.to_list(length=len(ids))
