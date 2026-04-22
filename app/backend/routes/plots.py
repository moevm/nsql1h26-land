"""
CRUD-маршруты для объявлений (plots) + поиск.
"""

import statistics
from datetime import datetime, timezone
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db, get_plot_repo
from config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from models import (
    LocationStatsOut,
    PlotCreate,
    PlotListOut,
    PlotOut,
    PlotUpdate,
    PriceHistoryPoint,
)
from services.feature_service import extract_features
from services.geo_service import compute_distances, compute_total_score
from services.listing_service import (
    ORDER_PATTERN,
    SORT_PATTERN,
    build_plot_filters,
    build_sort_spec,
    clamp_page,
    compute_pages,
    normalize_order,
    normalize_sort,
)
from services.search_service import invalidate_search_cache, search_plots
from auth import get_current_user, get_optional_user
from utils import serialize_doc as _serialize, parse_area as _parse_area

router = APIRouter(prefix="/api/plots", tags=["plots"])

_ERR_INVALID_ID = "Invalid ID"
_ERR_NOT_FOUND = "Plot not found"


def _get_oid(plot_id: str) -> ObjectId:
    """Парсит строку в ObjectId, бросает ValueError если невалидно."""
    try:
        return ObjectId(plot_id)
    except Exception as exc:
        raise ValueError(_ERR_INVALID_ID) from exc


def _prepare_plot_doc(doc: dict) -> dict:
    """Нормализует документ для ответа клиенту."""
    serialized = _serialize(doc)
    geo = serialized.get("geo_location")
    if ("lat" not in serialized or "lon" not in serialized) and geo and "coordinates" in geo:
        coords = geo["coordinates"]
        serialized.setdefault("lat", coords[1] if len(coords) > 1 else 0)
        serialized.setdefault("lon", coords[0] if len(coords) > 0 else 0)
    return serialized


def _make_price_history_entry(price: float) -> dict:
    return {
        "price": price,
        "at": datetime.now(timezone.utc),
    }


def _sync_price_history(existing: dict, updates: dict) -> None:
    existing_price = existing.get("price")
    incoming_price = updates.get("price")
    if incoming_price is None or incoming_price == existing_price:
        return

    history = list(existing.get("price_history", []))
    history.append(_make_price_history_entry(float(incoming_price)))
    updates["price_history"] = history


def _extract_existing_coords(existing: dict) -> tuple[float, float]:
    existing_geo = existing.get("geo_location", {})
    existing_coords = existing_geo.get("coordinates", [0, 0])
    existing_lon = existing_coords[0] if len(existing_coords) > 0 else 0
    existing_lat = existing_coords[1] if len(existing_coords) > 1 else 0
    return existing_lat, existing_lon


def _list_search_params(
    q: Annotated[Optional[str], Query()] = None,
    sort: Annotated[Optional[str], Query(pattern=SORT_PATTERN)] = None,
    order: Annotated[str, Query(pattern=ORDER_PATTERN)] = "desc",
    min_price: Annotated[Optional[float], Query(ge=0)] = None,
    max_price: Annotated[Optional[float], Query(ge=0)] = None,
    min_area: Annotated[Optional[float], Query(ge=0)] = None,
    max_area: Annotated[Optional[float], Query(ge=0)] = None,
    min_price_per_sotka: Annotated[Optional[float], Query(ge=0)] = None,
    max_price_per_sotka: Annotated[Optional[float], Query(ge=0)] = None,
    min_score: Annotated[Optional[float], Query(ge=0, le=1)] = None,
    min_infra: Annotated[Optional[float], Query(ge=0, le=1)] = None,
    min_feature: Annotated[Optional[float], Query(ge=0, le=1)] = None,
    location: Annotated[Optional[str], Query()] = None,
) -> dict:
    ranges_to_validate = [
        (min_price, max_price, "price"),
        (min_area, max_area, "area"),
        (min_price_per_sotka, max_price_per_sotka, "price_per_sotka"),
    ]
    for min_value, max_value, label in ranges_to_validate:
        if min_value is not None and max_value is not None and min_value > max_value:
            raise HTTPException(422, f"Invalid range for {label}: min must be <= max")

    return {
        "q": q,
        "sort": sort,
        "order": order,
        "min_price": min_price,
        "max_price": max_price,
        "min_area": min_area,
        "max_area": max_area,
        "min_price_per_sotka": min_price_per_sotka,
        "max_price_per_sotka": max_price_per_sotka,
        "min_score": min_score,
        "min_infra": min_infra,
        "min_feature": min_feature,
        "location": location,
    }


@router.get("", response_model=PlotListOut)
async def list_plots(
    params: Annotated[dict, Depends(_list_search_params)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
):
    """Список объявлений с пагинацией, фильтрами и опциональным семантическим поиском."""
    repo = get_plot_repo()
    q = (params["q"] or "").strip()
    sort = params["sort"]
    order = normalize_order(params["order"])
    has_query = bool(q)
    effective_sort = normalize_sort(sort, has_query=has_query)

    filters = {
        "min_price": params["min_price"],
        "max_price": params["max_price"],
        "min_area": params["min_area"],
        "max_area": params["max_area"],
        "min_price_per_sotka": params["min_price_per_sotka"],
        "max_price_per_sotka": params["max_price_per_sotka"],
        "min_score": params["min_score"],
        "min_infra": params["min_infra"],
        "min_feature": params["min_feature"],
        "location": params["location"],
    }

    if has_query:
        db = get_db()
        page_items, total, pages, safe_page = await search_plots(
            db,
            q,
            page=page,
            page_size=page_size,
            filters=filters,
            sort_field=effective_sort,
            sort_order=order,
        )
        items = [PlotOut(**_prepare_plot_doc(d)) for d in page_items]
        return PlotListOut(
            items=items,
            total=total,
            page=safe_page,
            page_size=page_size,
            pages=pages,
            has_prev=safe_page > 1,
            has_next=safe_page < pages,
        )

    query_filter = build_plot_filters(filters)
    total = await repo.count(query_filter)
    pages = compute_pages(total, page_size)
    safe_page = clamp_page(page, pages)
    docs = await repo.find_page(
        query_filter=query_filter,
        sort_fields=build_sort_spec(effective_sort, order),
        skip=(safe_page - 1) * page_size,
        limit=page_size,
    )
    items = [PlotOut(**_prepare_plot_doc(d)) for d in docs]

    return PlotListOut(
        items=items,
        total=total,
        page=safe_page,
        page_size=page_size,
        pages=pages,
        has_prev=safe_page > 1,
        has_next=safe_page < pages,
    )


@router.get("/map")
async def get_plots_for_map(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=5000)] = 1000,
):
    """Эндпоинт для карты: возвращает участки постранично с минимальными полями."""
    repo = get_plot_repo()
    projection = {
        "title": 1, "price": 1, "area_sotki": 1,
        "geo_location": 1, "total_score": 1,
        "location": 1, "features_text": 1,
    }
    total = await repo.count()
    pages = compute_pages(total, page_size)
    safe_page = clamp_page(page, pages)
    docs = await repo.find_page(
        projection=projection,
        sort_fields=[("_id", -1)],
        skip=(safe_page - 1) * page_size,
        limit=page_size,
    )
    items = []
    for d in docs:
        d["_id"] = str(d["_id"])
        geo = d.get("geo_location")
        if geo and "coordinates" in geo:
            coords = geo["coordinates"]
            d["lat"] = coords[1] if len(coords) > 1 else 0
            d["lon"] = coords[0] if len(coords) > 0 else 0
        else:
            d["lat"] = 0
            d["lon"] = 0
        items.append(d)
    return {"items": items, "total": total, "page": safe_page, "page_size": page_size, "pages": pages}


@router.get("/my", response_model=PlotListOut)
async def my_plots(
    user: Annotated[dict, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    sort: Annotated[
        str,
        Query(pattern="^(created_at|price|area_sotki|total_score|price_per_sotka|infra_score|feature_score)$"),
    ] = "created_at",
    order: Annotated[str, Query(pattern=ORDER_PATTERN)] = "desc",
):
    """Объявления текущего пользователя. Админ видит объявления без owner_id."""
    repo = get_plot_repo()

    if user["role"] == "admin":
        query_filter = {"$or": [{"owner_id": user["_id"]}, {"owner_id": None}, {"owner_id": {"$exists": False}}]}
    else:
        query_filter = {"owner_id": user["_id"]}

    total = await repo.count(query_filter)
    pages = compute_pages(total, page_size)
    safe_page = clamp_page(page, pages)
    normalized_sort = normalize_sort(sort, has_query=False)
    normalized_order = normalize_order(order)

    docs = await repo.find_page(
        query_filter=query_filter,
        sort_fields=build_sort_spec(normalized_sort, normalized_order),
        skip=(safe_page - 1) * page_size,
        limit=page_size,
    )
    items = [PlotOut(**_prepare_plot_doc(d)) for d in docs]
    return PlotListOut(
        items=items,
        total=total,
        page=safe_page,
        page_size=page_size,
        pages=pages,
        has_prev=safe_page > 1,
        has_next=safe_page < pages,
    )


@router.get("/locations/suggest", response_model=list[str])
async def suggest_locations(
    q: Annotated[str, Query(max_length=120)] = "",
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    """Автокомплит для фильтра по населённым пунктам."""
    repo = get_plot_repo()
    return await repo.suggest_locations(q, limit=limit)


@router.get(
    "/stats/location",
    response_model=LocationStatsOut,
    responses={400: {"description": "Location is required"}},
)
async def get_location_stats(location: Annotated[str, Query(min_length=2)]):
    """Агрегированная статистика по участкам выбранной локации."""
    repo = get_plot_repo()
    normalized = location.strip()
    if not normalized:
        raise HTTPException(400, "Location is required")

    query_filter = {"location": {"$regex": normalized, "$options": "i"}}
    docs = await repo.find_all(
        query_filter=query_filter,
        projection={"price_per_sotka": 1, "total_score": 1},
    )

    prices = [float(doc["price_per_sotka"]) for doc in docs if doc.get("price_per_sotka")]
    scores = [float(doc["total_score"]) for doc in docs if doc.get("total_score") is not None]

    avg_price = round(sum(prices) / len(prices), 2) if prices else None
    median_price = round(statistics.median(prices), 2) if prices else None
    avg_score = round(sum(scores) / len(scores), 4) if scores else None

    return LocationStatsOut(
        location=normalized,
        sample_size=len(docs),
        avg_price_per_sotka=avg_price,
        median_price_per_sotka=median_price,
        avg_total_score=avg_score,
    )


@router.get(
    "/{plot_id}/price-history",
    response_model=list[PriceHistoryPoint],
    responses={404: {"description": "Invalid ID or plot not found"}},
)
async def get_price_history(plot_id: str):
    """История изменения цены по объявлению."""
    repo = get_plot_repo()
    try:
        oid = _get_oid(plot_id)
    except ValueError:
        raise HTTPException(404, _ERR_INVALID_ID)

    doc = await repo.find_by_id(oid, projection={"price_history": 1})
    if not doc:
        raise HTTPException(404, _ERR_NOT_FOUND)

    history = doc.get("price_history", [])
    normalized = [
        PriceHistoryPoint(price=float(point["price"]), at=point["at"])
        for point in history
        if isinstance(point, dict) and point.get("price") is not None and point.get("at") is not None
    ]
    normalized.sort(key=lambda point: point.at)
    return normalized


@router.get(
    "/{plot_id}",
    response_model=PlotOut,
    responses={404: {"description": "Invalid ID or plot not found"}},
)
async def get_plot(plot_id: str):
    """Получить одно объявление с аналитикой."""
    repo = get_plot_repo()
    try:
        oid = _get_oid(plot_id)
    except ValueError:
        raise HTTPException(404, _ERR_INVALID_ID)

    doc = await repo.find_by_id(oid)
    if not doc:
        raise HTTPException(404, _ERR_NOT_FOUND)

    serialized = _prepare_plot_doc(doc)
    db = get_db()
    # Вычисляем расстояния в реальном времени
    lat = serialized.get("lat", 0)
    lon = serialized.get("lon", 0)
    if lat and lon:
        geo_data = await compute_distances(db, lat, lon)
        serialized["distances"] = geo_data["distances"]

    return PlotOut(**serialized)


@router.post("", response_model=PlotOut, status_code=201)
async def create_plot(data: PlotCreate, user: Annotated[dict | None, Depends(get_optional_user)]):
    """
    Добавить объявление.
    Автоматически рассчитывает текстовые фичи и расстояния.
    """
    db = get_db()
    repo = get_plot_repo()

    # Вычисляем площадь если не задана
    area = data.area_sotki or _parse_area(data.title, data.description)
    price_per_sotka = None
    if data.price and area and area > 0:
        price_per_sotka = round(data.price / area, 2)

    # Текстовые фичи
    feat_data = extract_features(data.title, data.description, data.geo_ref)

    # Гео-расстояния
    geo_data = await compute_distances(db, data.lat, data.lon)

    # Total score
    total_score = compute_total_score(
        infra_score=geo_data["infra_score"],
        negative_score=geo_data["negative_score"],
        feature_score=feat_data["feature_score"],
        price_per_sotka=price_per_sotka,
    )

    doc = {
        "title": data.title,
        "description": data.description,
        "price": data.price,
        "area_sotki": area,
        "price_per_sotka": price_per_sotka,
        "location": data.location,
        "address": data.address,
        "geo_ref": data.geo_ref,
        "geo_location": {"type": "Point", "coordinates": [data.lon, data.lat]},
        "url": data.url,
        "thumbnail": data.thumbnail,
        "images_count": data.images_count,
        "was_lowered": data.was_lowered,
        "features": feat_data["features"],
        "feature_score": feat_data["feature_score"],
        "features_text": feat_data["features_text"],
        "infra_score": geo_data["infra_score"],
        "negative_score": geo_data["negative_score"],
        "total_score": total_score,
        "created_at": datetime.now(timezone.utc),
        "price_history": [_make_price_history_entry(data.price)] if data.price is not None else [],
        "owner_id": user["_id"] if user else None,
        "owner_name": user["username"] if user else None,
    }

    result_id = await repo.insert_one(doc)
    doc["_id"] = str(result_id)
    invalidate_search_cache()

    return PlotOut(**doc)


@router.delete(
    "/{plot_id}",
    status_code=204,
    responses={
        403: {"description": "User cannot delete this plot"},
        404: {"description": "Invalid ID or plot not found"},
    },
)
async def delete_plot(plot_id: str, user: Annotated[dict, Depends(get_current_user)]):
    """Удалить объявление. Админ — любое, пользователь — только своё."""
    repo = get_plot_repo()
    try:
        oid = _get_oid(plot_id)
    except ValueError:
        raise HTTPException(404, _ERR_INVALID_ID)

    doc = await repo.find_by_id(oid, projection={"owner_id": 1})
    if not doc:
        raise HTTPException(404, _ERR_NOT_FOUND)

    if user["role"] != "admin" and doc.get("owner_id") != user["_id"]:
        raise HTTPException(403, "You can only delete your own plots")

    await repo.delete_one(oid)
    invalidate_search_cache()


@router.put(
    "/{plot_id}",
    response_model=PlotOut,
    responses={
        400: {"description": "No fields to update"},
        403: {"description": "User cannot edit this plot"},
        404: {"description": "Invalid ID or plot not found"},
    },
)
async def update_plot(
    plot_id: str,
    data: PlotUpdate,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Обновить объявление. Админ — любое, пользователь — только своё.
    Пересчитывает фичи и расстояния при изменении описания/координат.
    """
    db = get_db()
    repo = get_plot_repo()
    try:
        oid = _get_oid(plot_id)
    except ValueError:
        raise HTTPException(404, _ERR_INVALID_ID)

    existing = await repo.find_by_id(oid)
    if not existing:
        raise HTTPException(404, _ERR_NOT_FOUND)

    if user["role"] != "admin" and existing.get("owner_id") != user["_id"]:
        raise HTTPException(403, "You can only edit your own plots")

    # Merge updated fields
    updates = data.model_dump(exclude_none=True)

    if not updates:
        raise HTTPException(400, "No fields to update")

    _sync_price_history(existing, updates)

    # Determine if we need to recalculate
    title = updates.get("title", existing.get("title", ""))
    description = updates.get("description", existing.get("description", ""))
    geo_ref = updates.get("geo_ref", existing.get("geo_ref", ""))
    # Извлекаем текущие координаты из geo_location
    existing_lat, existing_lon = _extract_existing_coords(existing)
    lat = updates.get("lat", existing_lat)
    lon = updates.get("lon", existing_lon)
    price = updates.get("price", existing.get("price", 0))
    area = updates.get("area_sotki", existing.get("area_sotki"))

    text_changed = "title" in updates or "description" in updates or "geo_ref" in updates
    geo_changed = "lat" in updates or "lon" in updates

    if text_changed:
        feat_data = extract_features(title, description, geo_ref)
        updates["features"] = feat_data["features"]
        updates["feature_score"] = feat_data["feature_score"]
        updates["features_text"] = feat_data["features_text"]

    # Убираем lat/lon из updates — они не хранятся отдельно
    updates.pop("lat", None)
    updates.pop("lon", None)

    if geo_changed:
        updates["geo_location"] = {"type": "Point", "coordinates": [lon, lat]}
        geo_data = await compute_distances(db, lat, lon)
        updates["infra_score"] = geo_data["infra_score"]
        updates["negative_score"] = geo_data["negative_score"]

    # Recalculate price_per_sotka
    if not area:
        area = _parse_area(title, description)
    if area:
        updates["area_sotki"] = area
    price_per_sotka = None
    if price and area and area > 0:
        price_per_sotka = round(price / area, 2)
    updates["price_per_sotka"] = price_per_sotka

    # Recalculate total_score
    infra_score = updates.get("infra_score", existing.get("infra_score", 0))
    negative_score = updates.get("negative_score", existing.get("negative_score", 0))
    feature_score = updates.get("feature_score", existing.get("feature_score", 0))
    updates["total_score"] = compute_total_score(
        infra_score=infra_score,
        negative_score=negative_score,
        feature_score=feature_score,
        price_per_sotka=price_per_sotka,
    )

    updates["updated_at"] = datetime.now(timezone.utc)

    await repo.update_one(oid, updates)
    invalidate_search_cache()

    doc = await repo.find_by_id(oid)
    return PlotOut(**_prepare_plot_doc(doc))
