"""
CRUD-маршруты для объявлений (plots) + поиск.
"""

import math
import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query

from database import get_db
from config import COL_PLOTS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from models import PlotCreate, PlotOut, PlotListOut, SearchQuery, SearchResultItem, SearchResultOut
from services.feature_service import extract_features
from services.geo_service import compute_distances, compute_total_score
from services.search_service import search_plots

router = APIRouter(prefix="/api/plots", tags=["plots"])


def _serialize(doc: dict) -> dict:
    """Конвертирует MongoDB-документ в сериализуемый dict."""
    doc["_id"] = str(doc["_id"])
    doc.pop("embedding", None)
    return doc


def _parse_area(title: str, description: str) -> Optional[float]:
    """Извлекает площадь в сотках из заголовка/описания."""
    for text in [title, description]:
        m = re.search(r"(\d+[.,]?\d*)\s*сот", text, re.IGNORECASE)
        if m:
            return float(m.group(1).replace(",", "."))
        m = re.search(r"(\d+[.,]?\d*)\s*га", text, re.IGNORECASE)
        if m:
            return float(m.group(1).replace(",", ".")) * 100
    return None


@router.get("", response_model=PlotListOut)
async def list_plots(
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    sort: str = Query("created_at", pattern="^(created_at|price|area_sotki|total_score|price_per_sotka|infra_score|negative_score|feature_score)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
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
):
    """Список объявлений с пагинацией и фильтрами."""
    db = get_db()
    col = db[COL_PLOTS]

    # Build filter
    query_filter: dict = {}
    if min_price is not None or max_price is not None:
        price_f: dict = {}
        if min_price is not None:
            price_f["$gte"] = min_price
        if max_price is not None:
            price_f["$lte"] = max_price
        query_filter["price"] = price_f

    if min_area is not None or max_area is not None:
        area_f: dict = {}
        if min_area is not None:
            area_f["$gte"] = min_area
        if max_area is not None:
            area_f["$lte"] = max_area
        query_filter["area_sotki"] = area_f

    if min_price_per_sotka is not None or max_price_per_sotka is not None:
        pps_f: dict = {}
        if min_price_per_sotka is not None:
            pps_f["$gte"] = min_price_per_sotka
        if max_price_per_sotka is not None:
            pps_f["$lte"] = max_price_per_sotka
        query_filter["price_per_sotka"] = pps_f

    if min_score is not None:
        query_filter["total_score"] = {"$gte": min_score}

    if min_infra is not None:
        query_filter["infra_score"] = {"$gte": min_infra}

    if min_feature is not None:
        query_filter["feature_score"] = {"$gte": min_feature}

    if location:
        query_filter["location"] = {"$regex": location, "$options": "i"}

    total = await col.count_documents(query_filter)
    pages = max(1, math.ceil(total / page_size))

    sort_dir = 1 if order == "asc" else -1
    cursor = (
        col.find(query_filter, {"embedding": 0})
        .sort(sort, sort_dir)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    docs = await cursor.to_list(length=page_size)
    items = [PlotOut(**_serialize(d)) for d in docs]

    return PlotListOut(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/map")
async def get_plots_for_map():
    """Лёгкий эндпоинт для карты: возвращает все участки с минимальными полями."""
    db = get_db()
    projection = {
        "title": 1, "price": 1, "area_sotki": 1,
        "lat": 1, "lon": 1, "total_score": 1,
        "location": 1, "features_text": 1,
    }
    cursor = db[COL_PLOTS].find({}, projection)
    docs = await cursor.to_list(length=10000)
    items = []
    for d in docs:
        d["_id"] = str(d["_id"])
        items.append(d)
    return {"items": items, "total": len(items)}


@router.get("/search", response_model=SearchResultOut)
async def search(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_area: Optional[float] = None,
    max_area: Optional[float] = None,
):
    """
    Поиск по объявлениям: vector search + Jina rerank.
    Jina считает скоры сразу для ~100 кандидатов, результаты
    кэшируются в памяти. Повторный вызов Jina только при выходе
    за пределы кэша.
    """
    import math
    db = get_db()
    page_items, total = await search_plots(
        db, q,
        page=page,
        page_size=page_size,
        min_price=min_price,
        max_price=max_price,
        min_area=min_area,
        max_area=max_area,
    )

    items = []
    for doc in page_items:
        doc["_id"] = str(doc.get("_id", ""))
        items.append(SearchResultItem(**doc))

    pages = math.ceil(total / page_size) if total > 0 else 0
    return SearchResultOut(
        items=items, total=total, query=q,
        page=page, page_size=page_size, pages=pages,
    )


@router.get("/{plot_id}", response_model=PlotOut)
async def get_plot(plot_id: str):
    """Получить одно объявление с аналитикой."""
    db = get_db()
    try:
        oid = ObjectId(plot_id)
    except Exception:
        raise HTTPException(404, "Invalid ID")

    doc = await db[COL_PLOTS].find_one({"_id": oid}, {"embedding": 0})
    if not doc:
        raise HTTPException(404, "Plot not found")

    return PlotOut(**_serialize(doc))


@router.post("", response_model=PlotOut, status_code=201)
async def create_plot(data: PlotCreate):
    """
    Добавить объявление.
    Автоматически рассчитывает текстовые фичи, эмбединги и расстояния.
    """
    db = get_db()

    # Вычисляем площадь если не задана
    area = data.area_sotki or _parse_area(data.title, data.description)
    price_per_sotka = None
    if data.price and area and area > 0:
        price_per_sotka = round(data.price / area, 2)

    # Текстовые фичи + эмбеддинг
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
        "lat": data.lat,
        "lon": data.lon,
        "geo_location": {"type": "Point", "coordinates": [data.lon, data.lat]},
        "url": data.url,
        "thumbnail": data.thumbnail,
        "images_count": data.images_count,
        "was_lowered": data.was_lowered,
        "embedding": feat_data["embedding"],
        "features": feat_data["features"],
        "feature_score": feat_data["feature_score"],
        "features_text": feat_data["features_text"],
        "distances": geo_data["distances"],
        "infra_score": geo_data["infra_score"],
        "negative_score": geo_data["negative_score"],
        "total_score": total_score,
        "created_at": datetime.now(timezone.utc),
    }

    result = await db[COL_PLOTS].insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc.pop("embedding", None)

    return PlotOut(**doc)


@router.delete("/{plot_id}", status_code=204)
async def delete_plot(plot_id: str):
    """Удалить объявление."""
    db = get_db()
    try:
        oid = ObjectId(plot_id)
    except Exception:
        raise HTTPException(404, "Invalid ID")

    result = await db[COL_PLOTS].delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(404, "Plot not found")
