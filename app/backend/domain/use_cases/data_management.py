from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from domain.entities import InfraObject, Plot, PriceHistoryEntry, User
from domain.exceptions import NotAuthorizedError, ValidationError
from domain.repository_interfaces import InfraRepositoryInterface, PlotRepositoryInterface
from domain.scoring import compute_total_score
from domain.value_objects import FeatureResult, GeoScoreResult

logger = logging.getLogger(__name__)

_BACKGROUND_TASKS: set[asyncio.Task[Any]] = set()


class ExportAllUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        infra_repo: InfraRepositoryInterface,
        col_plots: str,
        infra_slugs: list[str],
    ):
        self._plot_repo = plot_repo
        self._infra_repo = infra_repo
        self._col_plots = col_plots
        self._infra_slugs = infra_slugs

    async def execute(self, current_user: User) -> dict:
        if current_user.role != "admin":
            raise NotAuthorizedError("Admin access required")

        result = {}
        plots = await self._plot_repo.find_all()
        result[self._col_plots] = [_serialize_plot(p) for p in plots]
        for slug in self._infra_slugs:
            objects = await self._infra_repo.find_all(slug)
            result[slug] = [_serialize_infra(o) for o in objects]
        return result


class ExportCollectionUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        infra_repo: InfraRepositoryInterface,
        all_collections: list[str],
        col_plots: str,
    ):
        self._plot_repo = plot_repo
        self._infra_repo = infra_repo
        self._all_collections = all_collections
        self._col_plots = col_plots

    async def execute(self, collection: str, current_user: User) -> dict:
        if current_user.role != "admin":
            raise NotAuthorizedError("Admin access required")

        if collection not in self._all_collections:
            raise ValidationError(f"Unknown collection: {collection}")

        if collection == self._col_plots:
            items = await self._plot_repo.find_all()
            data = [_serialize_plot(p) for p in items]
        else:
            items = await self._infra_repo.find_all(collection)
            data = [_serialize_infra(o) for o in items]

        return {"collection": collection, "count": len(data), "data": data}


class ImportPlotsUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        infra_repo: InfraRepositoryInterface,
        uow_factory: callable,
        extract_features_batch: callable,
        compute_distances: callable,
        invalidate_cache: callable,
        parse_area: callable,
        feature_keys: list[str],
    ):
        self._plot_repo = plot_repo
        self._infra_repo = infra_repo
        self._uow_factory = uow_factory
        self._extract_features_batch = extract_features_batch
        self._compute_distances = compute_distances
        self._invalidate_cache = invalidate_cache
        self._parse_area = parse_area
        self._feature_keys = feature_keys

    async def execute(self, records: list[dict], current_user: User) -> int:
        if current_user.role != "admin":
            raise NotAuthorizedError("Admin access required")

        if not records:
            return 0

        feat_map = self._build_feature_map(records, self._feature_keys)
        feat_map = self._build_feature_map(records, feature_keys)

        inserted = 0
        uow = self._uow_factory()
        async with uow:
            for idx, rec in enumerate(records):
                coords = self._extract_coordinates(rec)
                if coords is None:
                    continue
                lat, lon = coords
                feat = feat_map.get(idx)
                if feat is None:
                    continue

                geo: GeoScoreResult = await self._compute_distances(self._infra_repo, lat, lon)
                doc = self._build_plot_doc(rec, feat, geo, lat, lon)

                if doc.get("avito_id"):
                    await self._plot_repo.upsert_by_avito_id(doc["avito_id"], doc, session=uow.session)
                else:
                    plot = Plot(
                        avito_id=doc.get("avito_id"),
                        title=doc.get("title", ""),
                        description=doc.get("description", ""),
                        price=doc.get("price", 0),
                        area_sotki=doc.get("area_sotki"),
                        price_per_sotka=doc.get("price_per_sotka"),
                        location=doc.get("location", ""),
                        address=doc.get("address", ""),
                        geo_ref=doc.get("geo_ref", ""),
                        lat=lat, lon=lon,
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
                        price_history=[
                            PriceHistoryEntry(price=doc["price_history"][0]["price"], at=doc["price_history"][0]["at"])
                        ] if doc.get("price_history") else [],
                        created_at=doc.get("created_at"),
                    )
                    await self._plot_repo.insert_one(plot, session=uow.session)
                inserted += 1

        if inserted:
            self._invalidate_cache()
        return inserted

    def _build_feature_map(self, records: list[dict], feature_keys: list[str]) -> dict[int, FeatureResult]:
        need_idx: list[int] = []
        have_nested_idx: list[int] = []
        have_flat_idx: list[int] = []

        for i, rec in enumerate(records):
            if isinstance(rec.get("features"), dict) and rec.get("feature_score") is not None:
                have_nested_idx.append(i)
            elif rec.get("feature_score") is not None and any(rec.get(k) is not None for k in feature_keys):
                have_flat_idx.append(i)
            else:
                need_idx.append(i)

        feat_map: dict[int, FeatureResult] = {}

        if need_idx:
            computed = self._extract_features_batch([records[i] for i in need_idx])
            for j, rec_idx in enumerate(need_idx):
                feat_map[rec_idx] = computed[j]

        for rec_idx in have_nested_idx:
            rec = records[rec_idx]
            feat_map[rec_idx] = FeatureResult(
                features=rec["features"],
                feature_score=rec["feature_score"],
                features_text=rec.get("features_text", ""),
            )

        for rec_idx in have_flat_idx:
            rec = records[rec_idx]
            feat_map[rec_idx] = FeatureResult(
                features={key: rec.get(key, 0.0) for key in feature_keys},
                feature_score=rec["feature_score"],
                features_text=rec.get("features_text", ""),
            )

        return feat_map

    @staticmethod
    def _extract_coordinates(rec: dict) -> tuple[float, float] | None:
        lat = rec.get("lat", 0)
        lon = rec.get("lon", rec.get("lng", 0))
        if not lat or not lon:
            return None
        return lat, lon

    def _build_plot_doc(self, rec: dict, feat: FeatureResult, geo: GeoScoreResult, lat: float, lon: float) -> dict:
        area = rec.get("area_sotki")
        if not area:
            area = self._parse_area(rec.get("title", ""), rec.get("description", ""))

        price = rec.get("price", 0)
        price_per_sotka = rec.get("price_per_sotka")
        if not price_per_sotka and price and area and area > 0:
            price_per_sotka = round(price / area, 2)

        total_score = compute_total_score(
            infra_score=geo.infra_score,
            negative_score=geo.negative_score,
            feature_score=feat.feature_score,
            price_per_sotka=price_per_sotka,
        )

        return {
            "avito_id": rec.get("avito_id", rec.get("id")),
            "title": rec.get("title", ""),
            "description": rec.get("description", ""),
            "price": price,
            "area_sotki": area,
            "price_per_sotka": price_per_sotka,
            "location": rec.get("location", rec.get("locationName", "")),
            "address": rec.get("address", rec.get("addressFull", "")),
            "geo_ref": rec.get("geo_ref", rec.get("geoReferences", "")),
            "lat": lat,
            "lon": lon,
            "geo_location": {"type": "Point", "coordinates": [lon, lat]},
            "url": rec.get("url", ""),
            "thumbnail": rec.get("thumbnail", ""),
            "images_count": rec.get("images_count", rec.get("imagesCount", 0)),
            "was_lowered": rec.get("was_lowered", rec.get("wasLowered", False)),
            "features": feat.features,
            "feature_score": feat.feature_score,
            "features_text": feat.features_text,
            "infra_score": geo.infra_score,
            "negative_score": geo.negative_score,
            "total_score": total_score,
            "created_at": datetime.now(timezone.utc),
            "price_history": _build_price_history(rec, price),
        }


class ClearCollectionUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        infra_repo: InfraRepositoryInterface,
        invalidate_cache: callable,
        recalculate_fn: callable,
        all_collections: list[str],
        col_plots: str,
    ):
        self._plot_repo = plot_repo
        self._infra_repo = infra_repo
        self._invalidate_cache = invalidate_cache
        self._recalculate_fn = recalculate_fn
        self._all_collections = all_collections
        self._col_plots = col_plots

    async def execute(self, collection: str, current_user: User) -> int:
        if current_user.role != "admin":
            raise NotAuthorizedError("Admin access required")

        if collection not in self._all_collections:
            raise ValidationError(f"Unknown collection: {collection}")

        if collection == self._col_plots:
            deleted = await self._plot_repo.delete_all()
            if deleted:
                self._invalidate_cache()
        else:
            deleted = await self._infra_repo.delete_all(collection)
            async def _run():
                try:
                    n = await self._recalculate_fn()
                    logger.info("Recalculated scores for %d plots after clear", n)
                except Exception as exc:
                    logger.warning("Failed to recalculate: %s", exc)
            task = asyncio.create_task(_run())
            _BACKGROUND_TASKS.add(task)
            task.add_done_callback(_BACKGROUND_TASKS.discard)

        return deleted


class GetStatsUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        infra_repo: InfraRepositoryInterface,
        col_plots: str,
        infra_slugs: list[str],
    ):
        self._plot_repo = plot_repo
        self._infra_repo = infra_repo
        self._col_plots = col_plots
        self._infra_slugs = infra_slugs

    async def execute(self, current_user: User) -> dict:
        if current_user.role != "admin":
            raise NotAuthorizedError("Admin access required")

        stats = {}
        stats[self._col_plots] = await self._plot_repo.count()
        for slug in self._infra_slugs:
            stats[slug] = await self._infra_repo.count(slug)
        return stats


def _serialize_plot(plot: Plot) -> dict:
    d: dict = {
        "_id": plot.id,
        "avito_id": plot.avito_id,
        "title": plot.title, "description": plot.description,
        "price": plot.price, "area_sotki": plot.area_sotki,
        "price_per_sotka": plot.price_per_sotka,
        "location": plot.location, "address": plot.address,
        "geo_ref": plot.geo_ref,
        "geo_location": {"type": "Point", "coordinates": [plot.lon, plot.lat]},
        "url": plot.url, "thumbnail": plot.thumbnail,
        "images_count": plot.images_count, "was_lowered": plot.was_lowered,
        "features": plot.features, "feature_score": plot.feature_score,
        "features_text": plot.features_text,
        "infra_score": plot.infra_score, "negative_score": plot.negative_score,
        "total_score": plot.total_score,
        "owner_id": plot.owner_id, "owner_name": plot.owner_name,
        "created_at": plot.created_at.isoformat() if plot.created_at else None,
        "updated_at": plot.updated_at.isoformat() if plot.updated_at else None,
    }
    if plot.price_history:
        d["price_history"] = [
            {"price": p.price, "at": p.at.isoformat() if hasattr(p.at, "isoformat") else str(p.at)}
            for p in plot.price_history
        ]
    return d


def _serialize_infra(obj: InfraObject) -> dict:
    return {
        "_id": obj.id,
        "name": obj.name,
        "type": obj.type,
        "subtype": obj.subtype,
        "location": {"type": "Point", "coordinates": [obj.lon, obj.lat]},
    }


def _build_price_history(rec: dict, price) -> list[dict]:
    existing = rec.get("price_history")
    if existing:
        return existing
    if price is None:
        return []
    return [{"price": price, "at": datetime.now(timezone.utc)}]
