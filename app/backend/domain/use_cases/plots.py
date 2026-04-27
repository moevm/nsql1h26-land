from __future__ import annotations

import statistics
from datetime import datetime, timezone

from domain.entities import Plot, PriceHistoryEntry, User
from domain.exceptions import InvalidIdError, NotFoundError, NotAuthorizedError, ValidationError
from domain.repository_interfaces import InfraRepositoryInterface, PlotRepositoryInterface
from domain.scoring import compute_geo_score, compute_total_score
from domain.value_objects import FeatureResult, GeoScoreResult, Page, Pagination


class CreatePlotUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        infra_repo: InfraRepositoryInterface,
        extract_features: callable,
        compute_distances: callable,
        invalidate_cache: callable,
    ):
        self._plot_repo = plot_repo
        self._infra_repo = infra_repo
        self._extract_features = extract_features
        self._compute_distances = compute_distances
        self._invalidate_cache = invalidate_cache

    async def execute(self, data: dict, current_user: User) -> Plot:
        lat = data["lat"]
        lon = data["lon"]
        price = data.get("price", 0)
        title = data.get("title", "")
        description = data.get("description", "")
        geo_ref = data.get("geo_ref", "")

        area = data.get("area_sotki")
        price_per_sotka = round(price / area, 2) if price and area and area > 0 else None

        feat: FeatureResult = self._extract_features(title, description, geo_ref)
        geo: GeoScoreResult = await self._compute_distances(self._infra_repo, lat, lon)

        total_score = compute_total_score(
            infra_score=geo.infra_score,
            negative_score=geo.negative_score,
            feature_score=feat.feature_score,
            price_per_sotka=price_per_sotka,
        )

        plot = Plot(
            avito_id=data.get("avito_id"),
            title=title, description=description, price=price,
            area_sotki=area, price_per_sotka=price_per_sotka,
            location=data.get("location", ""), address=data.get("address", ""),
            geo_ref=geo_ref, lat=lat, lon=lon,
            url=data.get("url", ""), thumbnail=data.get("thumbnail", ""),
            images_count=data.get("images_count", 0),
            was_lowered=data.get("was_lowered", False),
            features=feat.features, feature_score=feat.feature_score,
            features_text=feat.features_text,
            infra_score=geo.infra_score, negative_score=geo.negative_score,
            total_score=total_score,
            price_history=[PriceHistoryEntry(price=price, at=datetime.now(timezone.utc))] if price else [],
            owner_id=current_user.id, owner_name=current_user.username,
            created_at=datetime.now(timezone.utc),
        )

        plot_id = await self._plot_repo.insert_one(plot)
        plot.id = plot_id
        self._invalidate_cache()
        return plot


class UpdatePlotUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        infra_repo: InfraRepositoryInterface,
        extract_features: callable,
        compute_distances: callable,
        invalidate_cache: callable,
        parse_area: callable,
    ):
        self._plot_repo = plot_repo
        self._infra_repo = infra_repo
        self._extract_features = extract_features
        self._compute_distances = compute_distances
        self._invalidate_cache = invalidate_cache
        self._parse_area = parse_area

    async def execute(self, plot_id: str, updates: dict, current_user: User) -> Plot:
        existing = await self._plot_repo.find_by_id(plot_id)
        if not existing:
            raise NotFoundError("Plot", plot_id)
        if current_user.role != "admin" and existing.owner_id != current_user.id:
            raise NotAuthorizedError("You can only edit your own plots")

        if not updates:
            raise ValidationError("No fields to update")

        # sync price history
        incoming_price = updates.get("price")
        if incoming_price is not None and incoming_price != existing.price:
            history = list(existing.price_history)
            history.append(PriceHistoryEntry(price=float(incoming_price), at=datetime.now(timezone.utc)))
            updates["price_history"] = [{"price": p.price, "at": p.at} for p in history]

        title = updates.get("title", existing.title)
        description = updates.get("description", existing.description)
        geo_ref = updates.get("geo_ref", existing.geo_ref)
        lat = updates.get("lat", existing.lat)
        lon = updates.get("lon", existing.lon)
        price = updates.get("price", existing.price)
        area = updates.get("area_sotki", existing.area_sotki)

        text_changed = "title" in updates or "description" in updates or "geo_ref" in updates
        geo_changed = "lat" in updates or "lon" in updates

        if text_changed:
            feat = self._extract_features(title, description, geo_ref)
            updates["features"] = feat.features
            updates["feature_score"] = feat.feature_score
            updates["features_text"] = feat.features_text

        updates.pop("lat", None)
        updates.pop("lon", None)

        if geo_changed:
            updates["geo_location"] = {"type": "Point", "coordinates": [lon, lat]}
            geo = await self._compute_distances(self._infra_repo, lat, lon)
            updates["infra_score"] = geo.infra_score
            updates["negative_score"] = geo.negative_score

        if not area:
            area = self._parse_area(title, description)
        if area:
            updates["area_sotki"] = area
        price_per_sotka = None
        if price and area and area > 0:
            price_per_sotka = round(price / area, 2)
        updates["price_per_sotka"] = price_per_sotka

        infra_score = updates.get("infra_score", existing.infra_score)
        negative_score = updates.get("negative_score", existing.negative_score)
        feature_score = updates.get("feature_score", existing.feature_score)
        updates["total_score"] = compute_total_score(
            infra_score=infra_score,
            negative_score=negative_score,
            feature_score=feature_score,
            price_per_sotka=price_per_sotka,
        )

        updates["updated_at"] = datetime.now(timezone.utc)

        await self._plot_repo.update_one(plot_id, updates)
        self._invalidate_cache()

        updated_plot = await self._plot_repo.find_by_id(plot_id)
        if updated_plot and updated_plot.lat and updated_plot.lon:
            geo = await self._compute_distances(self._infra_repo, updated_plot.lat, updated_plot.lon)
            updated_plot.distances = geo.distances
        return updated_plot


class DeletePlotUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        invalidate_cache: callable,
    ):
        self._plot_repo = plot_repo
        self._invalidate_cache = invalidate_cache

    async def execute(self, plot_id: str, current_user: User) -> None:
        existing = await self._plot_repo.find_by_id(plot_id)
        if not existing:
            raise NotFoundError("Plot", plot_id)
        if current_user.role != "admin" and existing.owner_id != current_user.id:
            raise NotAuthorizedError("You can only delete your own plots")
        await self._plot_repo.delete_one(plot_id)
        self._invalidate_cache()


class GetPlotUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        infra_repo: InfraRepositoryInterface,
        compute_distances: callable,
    ):
        self._plot_repo = plot_repo
        self._infra_repo = infra_repo
        self._compute_distances = compute_distances

    async def execute(self, plot_id: str) -> Plot:
        plot = await self._plot_repo.find_by_id(plot_id)
        if not plot:
            raise NotFoundError("Plot", plot_id)
        if plot.lat and plot.lon:
            geo = await self._compute_distances(self._infra_repo, plot.lat, plot.lon)
            plot.distances = geo.distances
        return plot


class ListPlotsUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        build_filters: callable,
        build_sort: callable,
        compute_pages_fn: callable,
        clamp_page_fn: callable,
    ):
        self._plot_repo = plot_repo
        self._build_filters = build_filters
        self._build_sort = build_sort
        self._compute_pages = compute_pages_fn
        self._clamp_page = clamp_page_fn

    async def execute(self, filters: dict, pagination: Pagination, sort_field: str, sort_order: str) -> Page:
        query_filter = self._build_filters(filters)
        total = await self._plot_repo.count(query_filter)
        pages = self._compute_pages(total, pagination.page_size)
        safe_page = self._clamp_page(pagination.page, pages)
        plots = await self._plot_repo.find_page(
            query_filter=query_filter,
            sort_fields=self._build_sort(sort_field, sort_order),
            skip=(safe_page - 1) * pagination.page_size,
            limit=pagination.page_size,
        )
        return Page(
            items=plots, total=total, page=safe_page,
            page_size=pagination.page_size, pages=pages,
            has_prev=safe_page > 1, has_next=safe_page < pages,
        )


class SearchPlotsUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        search_engine: object,
        build_filters: callable,
        compute_pages_fn: callable,
        clamp_page_fn: callable,
    ):
        self._plot_repo = plot_repo
        self._search_engine = search_engine
        self._build_filters = build_filters
        self._compute_pages = compute_pages_fn
        self._clamp_page = clamp_page_fn

    async def execute(
        self,
        query: str,
        filters: dict,
        pagination: Pagination,
        sort_field: str,
        sort_order: str,
    ) -> tuple[list[dict], int, int, int]:
        page_items, total, pages, safe_page = await self._search_engine.search(
            self._plot_repo, query,
            page=pagination.page, page_size=pagination.page_size,
            filters=filters, sort_field=sort_field, sort_order=sort_order,
        )
        return page_items, total, pages, safe_page


class GetMapPlotsUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        compute_pages_fn: callable,
        clamp_page_fn: callable,
    ):
        self._plot_repo = plot_repo
        self._compute_pages = compute_pages_fn
        self._clamp_page = clamp_page_fn

    async def execute(self, pagination: Pagination) -> Page:
        projection = {
            "title": 1, "price": 1, "area_sotki": 1,
            "geo_location": 1, "total_score": 1,
            "location": 1, "features_text": 1,
        }
        total = await self._plot_repo.count()
        pages = self._compute_pages(total, pagination.page_size)
        safe_page = self._clamp_page(pagination.page, pages)
        plots = await self._plot_repo.find_page(
            query_filter=None,
            sort_fields=[("_id", -1)],
            skip=(safe_page - 1) * pagination.page_size,
            limit=pagination.page_size,
            projection=projection,
        )
        return Page(
            items=plots, total=total, page=safe_page,
            page_size=pagination.page_size, pages=pages,
            has_prev=safe_page > 1, has_next=safe_page < pages,
        )


class GetMyPlotsUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        build_sort: callable,
        compute_pages_fn: callable,
        clamp_page_fn: callable,
        normalize_sort_fn: callable,
        normalize_order_fn: callable,
    ):
        self._plot_repo = plot_repo
        self._build_sort = build_sort
        self._compute_pages = compute_pages_fn
        self._clamp_page = clamp_page_fn
        self._normalize_sort = normalize_sort_fn
        self._normalize_order = normalize_order_fn

    async def execute(self, current_user: User, pagination: Pagination, sort: str, order: str) -> Page:
        if current_user.role == "admin":
            query_filter = {"$or": [{"owner_id": current_user.id}, {"owner_id": None}, {"owner_id": {"$exists": False}}]}
        else:
            query_filter = {"owner_id": current_user.id}

        total = await self._plot_repo.count(query_filter)
        pages = self._compute_pages(total, pagination.page_size)
        safe_page = self._clamp_page(pagination.page, pages)

        normalized_sort = self._normalize_sort(sort, has_query=False)
        normalized_order = self._normalize_order(order)

        plots = await self._plot_repo.find_page(
            query_filter=query_filter,
            sort_fields=self._build_sort(normalized_sort, normalized_order),
            skip=(safe_page - 1) * pagination.page_size,
            limit=pagination.page_size,
        )
        return Page(
            items=plots, total=total, page=safe_page,
            page_size=pagination.page_size, pages=pages,
            has_prev=safe_page > 1, has_next=safe_page < pages,
        )


class GetLocationSuggestionsUseCase:
    def __init__(self, plot_repo: PlotRepositoryInterface):
        self._plot_repo = plot_repo

    async def execute(self, query: str, limit: int = 20) -> list[str]:
        return await self._plot_repo.suggest_locations(query, limit=limit)


class GetLocationStatsUseCase:
    def __init__(self, plot_repo: PlotRepositoryInterface):
        self._plot_repo = plot_repo

    async def execute(self, location: str) -> dict:
        normalized = location.strip()
        if not normalized:
            raise ValidationError("Location is required")

        query_filter = {"location": {"$regex": normalized, "$options": "i"}}
        plots = await self._plot_repo.find_all(
            query_filter=query_filter,
            projection={"price_per_sotka": 1, "total_score": 1},
        )

        prices = [p.price_per_sotka for p in plots if p.price_per_sotka]
        scores = [p.total_score for p in plots if p.total_score is not None]

        avg_price = round(sum(prices) / len(prices), 2) if prices else None
        median_price = round(statistics.median(prices), 2) if prices else None
        avg_score = round(sum(scores) / len(scores), 4) if scores else None

        return {
            "location": normalized,
            "sample_size": len(plots),
            "avg_price_per_sotka": avg_price,
            "median_price_per_sotka": median_price,
            "avg_total_score": avg_score,
        }


class GetPriceHistoryUseCase:
    def __init__(self, plot_repo: PlotRepositoryInterface):
        self._plot_repo = plot_repo

    async def execute(self, plot_id: str) -> list[PriceHistoryEntry]:
        plot = await self._plot_repo.find_by_id(plot_id, projection={"price_history": 1})
        if not plot:
            raise NotFoundError("Plot", plot_id)
        return sorted(plot.price_history, key=lambda p: p.at)


class RecalculateAllScoresUseCase:
    def __init__(
        self,
        plot_repo: PlotRepositoryInterface,
        infra_repo: InfraRepositoryInterface,
        compute_distances: callable,
    ):
        self._plot_repo = plot_repo
        self._infra_repo = infra_repo
        self._compute_distances = compute_distances

    async def execute(self) -> int:
        plots = await self._plot_repo.find_all(projection={"geo_location": 1, "feature_score": 1, "price_per_sotka": 1})
        updated = 0
        for plot in plots:
            if not plot.lat or not plot.lon:
                continue
            try:
                geo = await self._compute_distances(self._infra_repo, plot.lat, plot.lon)
                total = compute_total_score(
                    infra_score=geo.infra_score,
                    negative_score=geo.negative_score,
                    feature_score=plot.feature_score,
                    price_per_sotka=plot.price_per_sotka,
                )
                await self._plot_repo.update_one(plot.id, {
                    "infra_score": geo.infra_score,
                    "negative_score": geo.negative_score,
                    "total_score": total,
                })
                updated += 1
            except Exception:
                continue
        return updated
