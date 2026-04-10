"""
CRUD-маршруты для объявлений (plots) + поиск.
"""

import math
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db, get_plot_repo
from config import COL_PLOTS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from models import PlotCreate, PlotUpdate, PlotOut, PlotListOut, SearchResultItem, SearchResultOut
from services.feature_service import extract_features
from services.geo_service import compute_distances, compute_total_score
from services.search_service import search_plots
from auth import get_current_user, get_optional_user
from utils import serialize_doc as _serialize, parse_area as _parse_area

router = APIRouter(prefix="/api/plots", tags=["plots"])

_ERR_INVALID_ID = "Invalid ID"
_ERR_NOT_FOUND = "Plot not found"
_ORDER_PATTERN = "^(asc|desc)$"
_SORT_PATTERN = "^(relevance|created_at|price|area_sotki|total_score|price_per_sotka|infra_score|negative_score|feature_score)$"


def _get_oid(plot_id: str) -> ObjectId:
    """Парсит строку в ObjectId, бросает 404 если невалидно."""
    try:
        return ObjectId(plot_id)
    except Exception:
        raise HTTPException(404, _ERR_INVALID_ID)


def _build_range_filter(query_filter: dict, field: str, min_val, max_val):
    """Добавляет gte/lte фильтр если значения указаны."""
    f: dict = {}
    if min_val is not None:
        f["$gte"] = min_val
    if max_val is not None:
        f["$lte"] = max_val
    if f:
        query_filter[field] = f


def _prepare_plot_doc(doc: dict) -> dict:
    """Нормализует документ для ответа клиенту."""
    serialized = _serialize(doc)
    geo = serialized.get("geo_location")
    if ("lat" not in serialized or "lon" not in serialized) and geo and "coordinates" in geo:
        coords = geo["coordinates"]
        serialized.setdefault("lat", coords[1] if len(coords) > 1 else 0)
        serialized.setdefault("lon", coords[0] if len(coords) > 0 else 0)
    return serialized


def _list_search_params(
    q: Optional[str] = Query(None),
    sort: Optional[str] = Query(None, pattern=_SORT_PATTERN),
    order: str = Query("desc", pattern=_ORDER_PATTERN),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    min_area: Optional[float] = Query(None, ge=0),
    max_area: Optional[float] = Query(None, ge=0),
    min_price_per_sotka: Optional[float] = Query(None, ge=0),
    max_price_per_sotka: Optional[float] = Query(None, ge=0),
    min_score: Optional[float] = Query(None, ge=0, le=1),
    min_infra: Optional[float] = Query(None, ge=0, le=1),
    min_feature: Optional[float] = Query(None, ge=0),
    location: Optional[str] = Query(None),
) -> dict:
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


def _search_params(
    q: str = Query(..., min_length=1),
    sort: Optional[str] = Query(None, pattern=_SORT_PATTERN),
    order: str = Query("desc", pattern=_ORDER_PATTERN),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    min_area: Optional[float] = Query(None, ge=0),
    max_area: Optional[float] = Query(None, ge=0),
    min_price_per_sotka: Optional[float] = Query(None, ge=0),
    max_price_per_sotka: Optional[float] = Query(None, ge=0),
    min_score: Optional[float] = Query(None, ge=0, le=1),
    min_infra: Optional[float] = Query(None, ge=0, le=1),
    min_feature: Optional[float] = Query(None, ge=0),
    location: Optional[str] = Query(None),
) -> dict:
    params = _list_search_params(
        q=q,
        sort=sort,
        order=order,
        min_price=min_price,
        max_price=max_price,
        min_area=min_area,
        max_area=max_area,
        min_price_per_sotka=min_price_per_sotka,
        max_price_per_sotka=max_price_per_sotka,
        min_score=min_score,
        min_infra=min_infra,
        min_feature=min_feature,
        location=location,
    )
    return params


@router.get("", response_model=PlotListOut)
async def list_plots(
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    params: dict = Depends(_list_search_params),
):
    """Список объявлений с пагинацией, фильтрами и опциональным семантическим поиском."""
    repo = get_plot_repo()
    q = params["q"]
    sort = params["sort"]
    order = params["order"]
    effective_sort = sort or ("relevance" if q and q.strip() else "created_at")

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

    if q and q.strip():
        db = get_db()
        page_items, total, _ = await search_plots(
            db,
            q,
            page=page,
            page_size=page_size,
            filters=filters,
            sort_field=effective_sort,
            sort_order=order,
        )
        pages = max(1, math.ceil(total / page_size))
        items = [PlotOut(**_prepare_plot_doc(d)) for d in page_items]
        return PlotListOut(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    # Build filter
    query_filter: dict = {}
    _build_range_filter(query_filter, "price", filters["min_price"], filters["max_price"])
    _build_range_filter(query_filter, "area_sotki", filters["min_area"], filters["max_area"])
    _build_range_filter(query_filter, "price_per_sotka", filters["min_price_per_sotka"], filters["max_price_per_sotka"])
    _build_range_filter(query_filter, "total_score", filters["min_score"], None)
    _build_range_filter(query_filter, "infra_score", filters["min_infra"], None)
    _build_range_filter(query_filter, "feature_score", filters["min_feature"], None)

    if filters["location"]:
        query_filter["location"] = {"$regex": filters["location"], "$options": "i"}

    total = await repo.count(query_filter)
    pages = max(1, math.ceil(total / page_size))

    if effective_sort == "relevance":
        effective_sort = "created_at"

    sort_dir = 1 if order == "asc" else -1
    docs = await repo.find_page(
        query_filter=query_filter,
        sort_field=effective_sort,
        sort_dir=sort_dir,
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    items = [PlotOut(**_prepare_plot_doc(d)) for d in docs]

    return PlotListOut(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/map")
async def get_plots_for_map(
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=1000),
):
    """Эндпоинт для карты: возвращает участки постранично с минимальными полями."""
    repo = get_plot_repo()
    projection = {
        "title": 1, "price": 1, "area_sotki": 1,
        "geo_location": 1, "total_score": 1,
        "location": 1, "features_text": 1,
    }
    total = await repo.count()
    pages = max(1, math.ceil(total / page_size))
    docs = await repo.find_page(
        projection=projection,
        skip=(page - 1) * page_size,
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
    return {"items": items, "total": total, "page": page, "page_size": page_size, "pages": pages}


@router.get("/my", response_model=PlotListOut)
async def my_plots(
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    sort: str = Query("created_at", pattern="^(created_at|price|area_sotki|total_score)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    user: dict = Depends(get_current_user),
):
    """Объявления текущего пользователя. Админ видит объявления без owner_id."""
    repo = get_plot_repo()

    if user["role"] == "admin":
        query_filter = {"$or": [{"owner_id": user["_id"]}, {"owner_id": None}, {"owner_id": {"$exists": False}}]}
    else:
        query_filter = {"owner_id": user["_id"]}

    total = await repo.count(query_filter)
    pages = max(1, math.ceil(total / page_size))
    sort_dir = 1 if order == "asc" else -1

    docs = await repo.find_page(
        query_filter=query_filter,
        sort_field=sort,
        sort_dir=sort_dir,
        skip=(page - 1) * page_size,
        limit=page_size,
    )
    items = [PlotOut(**_serialize(d)) for d in docs]
    return PlotListOut(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.get("/search", response_model=SearchResultOut)
async def search(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    params: dict = Depends(_search_params),
):
    """
    Поиск по объявлениям: BM25 + feature scoring + Jina rerank.
    Jina считает скоры сразу для ~100 кандидатов, результаты
    кэшируются в памяти. Повторный вызов Jina только при выходе
    за пределы кэша.
    """
    import math
    db = get_db()
    q = params["q"]
    page_items, total, can_expand = await search_plots(
        db,
        q,
        page=page,
        page_size=page_size,
        filters={
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
        },
        sort_field=params["sort"] or "relevance",
        sort_order=params["order"],
    )

    items = [SearchResultItem(**_prepare_plot_doc(doc)) for doc in page_items]

    pages = math.ceil(total / page_size) if total > 0 else 0
    return SearchResultOut(
        items=items, total=total, query=q,
        page=page, page_size=page_size, pages=pages,
        can_expand=can_expand,
    )


@router.get("/{plot_id}", response_model=PlotOut)
async def get_plot(plot_id: str):
    """Получить одно объявление с аналитикой."""
    repo = get_plot_repo()
    oid = _get_oid(plot_id)

    doc = await repo.find_by_id(oid)
    if not doc:
        raise HTTPException(404, _ERR_NOT_FOUND)

    serialized = _serialize(doc)
    # Вычисляем расстояния в реальном времени
    lat = serialized.get("lat", 0)
    lon = serialized.get("lon", 0)
    if lat and lon:
        geo_data = await compute_distances(db, lat, lon)
        serialized["distances"] = geo_data["distances"]

    return PlotOut(**serialized)


@router.post("", response_model=PlotOut, status_code=201)
async def create_plot(data: PlotCreate, user: dict | None = Depends(get_optional_user)):
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
        "owner_id": user["_id"] if user else None,
        "owner_name": user["username"] if user else None,
    }

    result_id = await repo.insert_one(doc)
    doc["_id"] = str(result_id)

    return PlotOut(**doc)


@router.delete("/{plot_id}", status_code=204)
async def delete_plot(plot_id: str, user: dict = Depends(get_current_user)):
    """Удалить объявление. Админ — любое, пользователь — только своё."""
    repo = get_plot_repo()
    oid = _get_oid(plot_id)

    doc = await repo.find_by_id(oid, projection={"owner_id": 1})
    if not doc:
        raise HTTPException(404, _ERR_NOT_FOUND)

    if user["role"] != "admin" and doc.get("owner_id") != user["_id"]:
        raise HTTPException(403, "You can only delete your own plots")

    await repo.delete_one(oid)


@router.put("/{plot_id}", response_model=PlotOut)
async def update_plot(plot_id: str, data: PlotUpdate, user: dict = Depends(get_current_user)):
    """
    Обновить объявление. Админ — любое, пользователь — только своё.
    Пересчитывает фичи и расстояния при изменении описания/координат.
    """
    db = get_db()
    repo = get_plot_repo()
    oid = _get_oid(plot_id)

    existing = await repo.find_by_id(oid)
    if not existing:
        raise HTTPException(404, _ERR_NOT_FOUND)

    if user["role"] != "admin" and existing.get("owner_id") != user["_id"]:
        raise HTTPException(403, "You can only edit your own plots")

    # Merge updated fields
    updates = data.model_dump(exclude_none=True)

    if not updates:
        raise HTTPException(400, "No fields to update")

    # Determine if we need to recalculate
    title = updates.get("title", existing.get("title", ""))
    description = updates.get("description", existing.get("description", ""))
    geo_ref = updates.get("geo_ref", existing.get("geo_ref", ""))
    # Извлекаем текущие координаты из geo_location
    existing_geo = existing.get("geo_location", {})
    existing_coords = existing_geo.get("coordinates", [0, 0])
    existing_lon = existing_coords[0] if len(existing_coords) > 0 else 0
    existing_lat = existing_coords[1] if len(existing_coords) > 1 else 0
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

    doc = await repo.find_by_id(oid)
    return PlotOut(**_serialize(doc))
