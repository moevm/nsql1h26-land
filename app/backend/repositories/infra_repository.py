"""
Репозиторий инфраструктурных коллекций — CRUD и гео-запросы.
"""

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from config import INFRA_COLLECTIONS, COL_NEGATIVE

ALL_INFRA_COLLECTIONS = INFRA_COLLECTIONS + [COL_NEGATIVE]


class InfraRepository:
    """Абстракция доступа к инфраструктурным коллекциям."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db

    # ---------- Read ----------

    async def find_all(self, collection: str) -> list[dict]:
        cursor = self._db[collection].find({})
        return await cursor.to_list(length=1000)

    async def count(self, collection: str) -> int:
        return await self._db[collection].count_documents({})

    # ---------- Geo ----------

    async def find_nearest(self, collection: str, lon: float, lat: float) -> dict | None:
        """$geoNear — ближайший объект в коллекции."""
        pipeline = [
            {
                "$geoNear": {
                    "near": {"type": "Point", "coordinates": [lon, lat]},
                    "distanceField": "dist_meters",
                    "spherical": True,
                }
            },
            {"$limit": 1},
            {"$project": {"name": 1, "dist_meters": 1, "type": 1}},
        ]
        cursor = self._db[collection].aggregate(pipeline)
        result = await cursor.to_list(length=1)
        return result[0] if result else None

    # ---------- Create ----------

    async def insert_one(self, collection: str, doc: dict) -> ObjectId:
        result = await self._db[collection].insert_one(doc)
        return result.inserted_id

    async def insert_many(self, collection: str, docs: list[dict]) -> int:
        if not docs:
            return 0
        result = await self._db[collection].insert_many(docs)
        return len(result.inserted_ids)

    # ---------- Delete ----------

    async def delete_one(self, collection: str, oid: ObjectId) -> bool:
        result = await self._db[collection].delete_one({"_id": oid})
        return result.deleted_count > 0

    async def delete_all(self, collection: str) -> int:
        result = await self._db[collection].delete_many({})
        return result.deleted_count

    # ---------- Replace ----------

    async def replace_all(self, collection: str, docs: list[dict]) -> int:
        """Удаляет все документы и вставляет новые."""
        await self._db[collection].delete_many({})
        if not docs:
            return 0
        result = await self._db[collection].insert_many(docs)
        return len(result.inserted_ids)
