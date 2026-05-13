from __future__ import annotations

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from domain.entities import User
from domain.repository_interfaces import UserRepositoryInterface
from infrastructure.config import get_settings


class MotorUserRepository(UserRepositoryInterface):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._col = db[get_settings().col_users]

    def _doc_to_user(self, doc: dict) -> User:
        return User(
            id=str(doc["_id"]),
            username=doc.get("username", ""),
            role=doc.get("role", "user"),
            password_hash=doc.get("password_hash", ""),
            created_at=doc.get("created_at"),
        )

    async def find_by_id(self, user_id: str) -> User | None:
        try:
            oid = ObjectId(user_id)
        except Exception:
            return None
        doc = await self._col.find_one({"_id": oid})
        if doc is None:
            return None
        return self._doc_to_user(doc)

    async def find_by_username(self, username: str) -> User | None:
        doc = await self._col.find_one({"username": username})
        if doc is None:
            return None
        return self._doc_to_user(doc)

    async def count(self) -> int:
        return await self._col.count_documents({})

    async def insert_one(self, user: User) -> str:
        doc = {
            "username": user.username,
            "password_hash": user.password_hash,
            "role": user.role,
            "created_at": user.created_at,
        }
        result = await self._col.insert_one(doc)
        return str(result.inserted_id)

    async def update_password(self, user_id: str, pw_hash: str) -> None:
        try:
            oid = ObjectId(user_id)
        except Exception:
            return
        await self._col.update_one({"_id": oid}, {"$set": {"password_hash": pw_hash}})
