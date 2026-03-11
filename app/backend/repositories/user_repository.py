"""
Репозиторий коллекции users — CRUD-операции с пользователями.
"""

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from config import COL_USERS


class UserRepository:
    """Абстракция доступа к коллекции users."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self._col = db[COL_USERS]

    async def find_by_id(self, oid: ObjectId) -> dict | None:
        return await self._col.find_one({"_id": oid})

    async def find_by_username(self, username: str) -> dict | None:
        return await self._col.find_one({"username": username})

    async def count(self) -> int:
        return await self._col.count_documents({})

    async def insert_one(self, doc: dict) -> ObjectId:
        result = await self._col.insert_one(doc)
        return result.inserted_id
