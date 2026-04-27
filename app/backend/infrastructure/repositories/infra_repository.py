from __future__ import annotations

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from domain.entities import InfraObject
from domain.repository_interfaces import InfraRepositoryInterface
from infrastructure.config import get_settings


class MotorInfraRepository(InfraRepositoryInterface):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db
        self._col = db[get_settings().col_infra]

    def _slug_to_type(self, slug_or_type: str) -> str:
        return get_settings().infra_slug_to_type.get(slug_or_type, slug_or_type)

    def _doc_to_infra(self, doc: dict) -> InfraObject:
        return InfraObject(
            id=str(doc["_id"]),
            name=doc.get("name", ""),
            type=doc.get("type"),
            subtype=doc.get("subtype"),
            dist_meters=doc.get("dist_meters"),
        )

    async def find_all(self, infra_type: str) -> list[InfraObject]:
        t = self._slug_to_type(infra_type)
        cursor = self._col.find({"type": t})
        docs = await cursor.to_list(length=10000)
        return [self._doc_to_infra(d) for d in docs]

    async def find_all_any(self) -> list[InfraObject]:
        cursor = self._col.find({})
        docs = await cursor.to_list(length=100000)
        return [self._doc_to_infra(d) for d in docs]

    async def count(self, infra_type: str) -> int:
        t = self._slug_to_type(infra_type)
        return await self._col.count_documents({"type": t})

    async def count_all(self) -> int:
        return await self._col.count_documents({})

    async def find_nearest_per_type(self, lon: float, lat: float) -> dict[str, dict]:
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

    async def insert_one(self, infra_type: str, obj: InfraObject, session=None) -> str:
        t = self._slug_to_type(infra_type)
        doc = {
            "name": obj.name,
            "type": t,
            "location": {"type": "Point", "coordinates": [obj.lon, obj.lat]},
        }
        if obj.subtype:
            doc["subtype"] = obj.subtype
        result = await self._col.insert_one(doc, session=session)
        return str(result.inserted_id)

    async def insert_many(self, infra_type: str, objects: list[InfraObject], session=None) -> int:
        if not objects:
            return 0
        t = self._slug_to_type(infra_type)
        docs = []
        for obj in objects:
            doc = {
                "name": obj.name,
                "type": t,
                "location": {"type": "Point", "coordinates": [obj.lon, obj.lat]},
            }
            if obj.subtype:
                doc["subtype"] = obj.subtype
            docs.append(doc)
        result = await self._col.insert_many(docs, session=session)
        return len(result.inserted_ids)

    async def delete_one(self, infra_type: str, object_id: str) -> bool:
        t = self._slug_to_type(infra_type)
        try:
            oid = ObjectId(object_id)
        except Exception:
            return False
        result = await self._col.delete_one({"_id": oid, "type": t})
        return result.deleted_count > 0

    async def delete_all(self, infra_type: str, session=None) -> int:
        t = self._slug_to_type(infra_type)
        result = await self._col.delete_many({"type": t}, session=session)
        return result.deleted_count

    async def replace_all(self, infra_type: str, objects: list[InfraObject], session=None) -> int:
        t = self._slug_to_type(infra_type)
        await self._col.delete_many({"type": t}, session=session)
        if not objects:
            return 0
        docs = []
        for obj in objects:
            doc = {
                "name": obj.name,
                "type": t,
                "location": {"type": "Point", "coordinates": [obj.lon, obj.lat]},
            }
            if obj.subtype:
                doc["subtype"] = obj.subtype
            docs.append(doc)
        result = await self._col.insert_many(docs, session=session)
        return len(result.inserted_ids)
