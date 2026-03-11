"""
Репозиторий коллекции plots — CRUD и поисковые операции.
"""

import math
from datetime import datetime, timezone
from typing import Optional

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
        skip: int = 0,
        limit: int = 20,
        projection: dict | None = None,
    ) -> list[dict]:
        proj = projection or {"embedding": 0}
        cursor = (
            self._col.find(query_filter or {}, proj)
            .sort(sort_field, sort_dir)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def find_by_id(self, oid: ObjectId, projection: dict | None = None) -> dict | None:
        proj = projection or {"embedding": 0}
        return await self._col.find_one({"_id": oid}, proj)

    async def find_all(
        self,
        query_filter: dict | None = None,
        projection: dict | None = None,
    ) -> list[dict]:
        cursor = self._col.find(query_filter or {}, projection)
        return await cursor.to_list(length=None)

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

    # ---------- Vector search (Atlas) ----------

    async def vector_search_atlas(
        self,
        query_embedding: list[float],
        top_k: int = 100,
        filters: dict | None = None,
    ) -> list[dict]:
        vs_stage: dict = {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": query_embedding,
                "numCandidates": top_k * 2,
                "limit": top_k,
            }
        }
        if filters:
            vs_stage["$vectorSearch"]["filter"] = filters

        pipeline = [
            vs_stage,
            {"$addFields": {"search_score": {"$meta": "vectorSearchScore"}}},
            {"$project": {"embedding": 0}},
        ]
        cursor = self._col.aggregate(pipeline)
        return await cursor.to_list(length=top_k)

    async def vector_search_fallback(
        self,
        query_filter: dict | None = None,
    ) -> list[dict]:
        """Загружает все эмбеддинги для фолбэка (cosine в Python)."""
        cursor = self._col.find(query_filter or {}, {"embedding": 1, "_id": 1})
        return await cursor.to_list(length=None)

    async def find_by_ids(
        self,
        ids: list[ObjectId],
        projection: dict | None = None,
    ) -> list[dict]:
        proj = projection or {"embedding": 0}
        cursor = self._col.find({"_id": {"$in": ids}}, proj)
        return await cursor.to_list(length=len(ids))
