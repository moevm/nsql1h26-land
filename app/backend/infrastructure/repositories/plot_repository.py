from __future__ import annotations

import re
from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from domain.entities import Plot, PriceHistoryEntry
from domain.repository_interfaces import PlotRepositoryInterface
from infrastructure.config import get_settings


class MotorPlotRepository(PlotRepositoryInterface):
    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db
        self._col = db[get_settings().col_plots]

    def _doc_to_plot(self, doc: dict) -> Plot:
        geo = doc.get("geo_location", {})
        coords = geo.get("coordinates", [0, 0])
        lon = coords[0] if len(coords) > 0 else 0
        lat = coords[1] if len(coords) > 1 else 0

        price_history = []
        for point in doc.get("price_history", []):
            if isinstance(point, dict) and point.get("price") is not None:
                price_history.append(PriceHistoryEntry(
                    price=float(point["price"]),
                    at=point.get("at", datetime.now()),
                ))

        return Plot(
            id=str(doc["_id"]),
            avito_id=doc.get("avito_id"),
            title=doc.get("title", ""),
            description=doc.get("description", ""),
            price=doc.get("price", 0),
            area_sotki=doc.get("area_sotki"),
            price_per_sotka=doc.get("price_per_sotka"),
            location=doc.get("location", ""),
            address=doc.get("address", ""),
            geo_ref=doc.get("geo_ref", ""),
            lat=lat,
            lon=lon,
            url=doc.get("url", ""),
            thumbnail=doc.get("thumbnail", ""),
            images_count=doc.get("images_count", 0),
            was_lowered=doc.get("was_lowered", False),
            features=doc.get("features", {}),
            feature_score=doc.get("feature_score", 0),
            features_text=doc.get("features_text", ""),
            infra_score=doc.get("infra_score", 0),
            negative_score=doc.get("negative_score", 0),
            total_score=doc.get("total_score", 0),
            price_history=price_history,
            owner_id=doc.get("owner_id"),
            owner_name=doc.get("owner_name"),
            created_at=doc.get("created_at"),
            updated_at=doc.get("updated_at"),
        )

    def _plot_to_doc(self, plot: Plot) -> dict:
        doc: dict = {
            "title": plot.title,
            "description": plot.description,
            "price": plot.price,
            "area_sotki": plot.area_sotki,
            "price_per_sotka": plot.price_per_sotka,
            "location": plot.location,
            "address": plot.address,
            "geo_ref": plot.geo_ref,
            "geo_location": {"type": "Point", "coordinates": [plot.lon, plot.lat]},
            "url": plot.url,
            "thumbnail": plot.thumbnail,
            "images_count": plot.images_count,
            "was_lowered": plot.was_lowered,
            "features": plot.features,
            "feature_score": plot.feature_score,
            "features_text": plot.features_text,
            "infra_score": plot.infra_score,
            "negative_score": plot.negative_score,
            "total_score": plot.total_score,
            "owner_id": plot.owner_id,
            "owner_name": plot.owner_name,
            "created_at": plot.created_at,
            "updated_at": plot.updated_at,
        }
        if plot.avito_id is not None:
            doc["avito_id"] = plot.avito_id
        if plot.price_history:
            doc["price_history"] = [
                {"price": p.price, "at": p.at} for p in plot.price_history
            ]
        if plot.id is not None:
            doc["_id"] = ObjectId(plot.id)
        return doc

    async def find_by_id(self, plot_id: str, projection: dict | None = None) -> Plot | None:
        try:
            oid = ObjectId(plot_id)
        except Exception:
            return None
        doc = await self._col.find_one({"_id": oid}, projection)
        if doc is None:
            return None
        return self._doc_to_plot(doc)

    async def find_page(
        self,
        query_filter: dict | None,
        sort_fields: list[tuple[str, int]],
        skip: int,
        limit: int,
        projection: dict | None = None,
    ) -> list[Plot]:
        cursor = self._col.find(query_filter or {}, projection)
        cursor = cursor.sort(sort_fields).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [self._doc_to_plot(d) for d in docs]

    async def find_all(
        self,
        query_filter: dict | None = None,
        projection: dict | None = None,
    ) -> list[Plot]:
        cursor = self._col.find(query_filter or {}, projection)
        docs = await cursor.to_list(length=None)
        return [self._doc_to_plot(d) for d in docs]

    async def count(self, query_filter: dict | None = None) -> int:
        return await self._col.count_documents(query_filter or {})

    async def insert_one(self, plot: Plot, session=None) -> str:
        doc = self._plot_to_doc(plot)
        doc.pop("_id", None)
        result = await self._col.insert_one(doc, session=session)
        return str(result.inserted_id)

    async def update_one(self, plot_id: str, updates: dict, session=None) -> bool:
        try:
            oid = ObjectId(plot_id)
        except Exception:
            return False
        result = await self._col.update_one({"_id": oid}, {"$set": updates}, session=session)
        return result.modified_count > 0

    async def upsert_by_avito_id(self, avito_id: int, updates: dict, session=None) -> None:
        await self._col.update_one(
            {"avito_id": avito_id},
            {"$set": updates},
            upsert=True,
            session=session,
        )

    async def delete_one(self, plot_id: str) -> bool:
        try:
            oid = ObjectId(plot_id)
        except Exception:
            return False
        result = await self._col.delete_one({"_id": oid})
        return result.deleted_count > 0

    async def delete_all(self) -> int:
        result = await self._col.delete_many({})
        return result.deleted_count

    async def suggest_locations(self, query: str, limit: int = 20) -> list[str]:
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

    async def aggregate(self, pipeline: list[dict]) -> list[dict]:
        cursor = self._col.aggregate(pipeline)
        return await cursor.to_list(length=None)

    async def find_all_prices(self) -> list[float]:
        cursor = self._col.find(
            {"price_per_sotka": {"$ne": None}},
            {"price_per_sotka": 1},
        )
        docs = await cursor.to_list(length=None)
        return [float(d["price_per_sotka"]) for d in docs if d.get("price_per_sotka") is not None]
