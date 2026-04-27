import statistics
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from domain.entities import Plot, User
from domain.exceptions import DomainError, NotFoundError, InvalidIdError
from domain.use_cases.plots import (
    CreatePlotUseCase,
    DeletePlotUseCase,
    GetLocationStatsUseCase,
    GetLocationSuggestionsUseCase,
    GetMapPlotsUseCase,
    GetMyPlotsUseCase,
    GetPlotUseCase,
    GetPriceHistoryUseCase,
    ListPlotsUseCase,
    SearchPlotsUseCase,
    UpdatePlotUseCase,
)
from domain.value_objects import Pagination
from infrastructure.config import get_settings
from infrastructure.listing import (
    ORDER_PATTERN,
    SORT_PATTERN,
    normalize_order,
    normalize_sort,
)
from interfaces.api.deps import (
    get_create_plot_use_case,
    get_delete_plot_use_case,
    get_current_user,
    get_list_plots_use_case,
    get_location_stats_use_case,
    get_location_suggestions_use_case,
    get_map_plots_use_case,
    get_my_plots_use_case,
    get_plot_use_case,
    get_price_history_use_case,
    get_search_plots_use_case,
    get_update_plot_use_case,
)
from interfaces.api.schemas import (
    LocationStatsOut,
    PlotCreate,
    PlotListOut,
    PlotOut,
    PlotUpdate,
    PriceHistoryPoint,
)

router = APIRouter(prefix="/api/plots", tags=["plots"])

settings = get_settings()


def _to_plot_out(plot: Plot) -> PlotOut:
    return PlotOut(
        _id=plot.id,
        avito_id=plot.avito_id,
        title=plot.title,
        description=plot.description,
        price=plot.price,
        area_sotki=plot.area_sotki,
        price_per_sotka=plot.price_per_sotka,
        location=plot.location,
        address=plot.address,
        geo_ref=plot.geo_ref,
        lat=plot.lat,
        lon=plot.lon,
        url=plot.url,
        thumbnail=plot.thumbnail,
        images_count=plot.images_count,
        was_lowered=plot.was_lowered,
        features=plot.features,
        feature_score=plot.feature_score,
        features_text=plot.features_text,
        distances=plot.distances,
        infra_score=plot.infra_score,
        negative_score=plot.negative_score,
        total_score=plot.total_score,
        created_at=plot.created_at,
        updated_at=plot.updated_at,
        owner_id=plot.owner_id,
        owner_name=plot.owner_name,
        price_history=[
            PriceHistoryPoint(price=p.price, at=p.at) for p in plot.price_history
        ],
    )


def _search_dict_to_plot_out(d: dict) -> PlotOut:
    return PlotOut(**d)


@router.get("", response_model=PlotListOut)
async def list_plots(
    q: Annotated[str | None, Query()] = None,
    sort: Annotated[str | None, Query(pattern=SORT_PATTERN)] = None,
    order: Annotated[str, Query(pattern=ORDER_PATTERN)] = "desc",
    min_price: Annotated[float | None, Query(ge=0)] = None,
    max_price: Annotated[float | None, Query(ge=0)] = None,
    min_area: Annotated[float | None, Query(ge=0)] = None,
    max_area: Annotated[float | None, Query(ge=0)] = None,
    min_price_per_sotka: Annotated[float | None, Query(ge=0)] = None,
    max_price_per_sotka: Annotated[float | None, Query(ge=0)] = None,
    min_score: Annotated[float | None, Query(ge=0, le=1)] = None,
    min_infra: Annotated[float | None, Query(ge=0, le=1)] = None,
    min_feature: Annotated[float | None, Query(ge=0, le=1)] = None,
    location: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=settings.max_page_size)] = settings.default_page_size,
):
    query_text = (q or "").strip()
    effective_sort = normalize_sort(sort, has_query=bool(query_text))
    effective_order = normalize_order(order)

    filters = {
        "min_price": min_price, "max_price": max_price,
        "min_area": min_area, "max_area": max_area,
        "min_price_per_sotka": min_price_per_sotka, "max_price_per_sotka": max_price_per_sotka,
        "min_score": min_score, "min_infra": min_infra, "min_feature": min_feature,
        "location": location,
    }
    pagination = Pagination(page=page, page_size=page_size, max_page_size=settings.max_page_size)

    if query_text:
        use_case = get_search_plots_use_case()
        items_dicts, total, pages, safe_page = await use_case.execute(
            query_text, filters, pagination, effective_sort, effective_order,
        )
        items = [_search_dict_to_plot_out(d) for d in items_dicts]
        return PlotListOut(
            items=items, total=total, page=safe_page,
            page_size=page_size, pages=pages,
            has_prev=safe_page > 1, has_next=safe_page < pages,
        )

    use_case = get_list_plots_use_case()
    result = await use_case.execute(filters, pagination, effective_sort, effective_order)
    return PlotListOut(
        items=[_to_plot_out(p) for p in result.items],
        total=result.total, page=result.page,
        page_size=result.page_size, pages=result.pages,
        has_prev=result.has_prev, has_next=result.has_next,
    )


@router.get("/map")
async def get_plots_for_map(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=5000)] = 1000,
):
    pagination = Pagination(page=page, page_size=page_size)
    use_case = get_map_plots_use_case()
    result = await use_case.execute(pagination)
    items = []
    for p in result.items:
        items.append({
            "_id": p.id, "title": p.title, "price": p.price,
            "area_sotki": p.area_sotki, "total_score": p.total_score,
            "location": p.location, "features_text": p.features_text,
            "lat": p.lat, "lon": p.lon,
        })
    return {
        "items": items, "total": result.total,
        "page": result.page, "page_size": result.page_size, "pages": result.pages,
    }


@router.get("/my", response_model=PlotListOut)
async def my_plots(
    user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=settings.max_page_size)] = settings.default_page_size,
    sort: Annotated[
        str,
        Query(pattern="^(created_at|price|area_sotki|total_score|price_per_sotka|infra_score|feature_score)$"),
    ] = "created_at",
    order: Annotated[str, Query(pattern=ORDER_PATTERN)] = "desc",
):
    pagination = Pagination(page=page, page_size=page_size)
    use_case = get_my_plots_use_case()
    result = await use_case.execute(user, pagination, sort, order)
    return PlotListOut(
        items=[_to_plot_out(p) for p in result.items],
        total=result.total, page=result.page,
        page_size=result.page_size, pages=result.pages,
        has_prev=result.has_prev, has_next=result.has_next,
    )


@router.get("/locations/suggest", response_model=list[str])
async def suggest_locations(
    q: Annotated[str, Query(max_length=120)] = "",
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    use_case = get_location_suggestions_use_case()
    return await use_case.execute(q, limit=limit)


@router.get("/stats/location", response_model=LocationStatsOut)
async def get_location_stats(location: Annotated[str, Query(min_length=2)]):
    use_case = get_location_stats_use_case()
    result = await use_case.execute(location)
    return LocationStatsOut(**result)


@router.get("/{plot_id}/price-history", response_model=list[PriceHistoryPoint])
async def get_price_history(plot_id: str):
    use_case = get_price_history_use_case()
    try:
        history = await use_case.execute(plot_id)
    except InvalidIdError:
        raise HTTPException(404, "Invalid ID")
    except NotFoundError:
        raise HTTPException(404, "Plot not found")
    return [PriceHistoryPoint(price=p.price, at=p.at) for p in history]


@router.get("/{plot_id}", response_model=PlotOut)
async def get_plot(plot_id: str):
    use_case = get_plot_use_case()
    try:
        plot = await use_case.execute(plot_id)
    except InvalidIdError:
        raise HTTPException(404, "Invalid ID")
    except NotFoundError:
        raise HTTPException(404, "Plot not found")
    return _to_plot_out(plot)


@router.post("", response_model=PlotOut, status_code=201)
async def create_plot(
    data: PlotCreate,
    user: Annotated[User, Depends(get_current_user)],
    use_case: CreatePlotUseCase = Depends(get_create_plot_use_case),
):
    plot = await use_case.execute(data.model_dump(), user)
    return _to_plot_out(plot)


@router.delete("/{plot_id}", status_code=204)
async def delete_plot(
    plot_id: str,
    user: Annotated[User, Depends(get_current_user)],
    use_case: DeletePlotUseCase = Depends(get_delete_plot_use_case),
):
    try:
        await use_case.execute(plot_id, user)
    except InvalidIdError:
        raise HTTPException(404, "Invalid ID")
    except NotFoundError:
        raise HTTPException(404, "Plot not found")
    except DomainError as e:
        raise HTTPException(403, str(e))


@router.put("/{plot_id}", response_model=PlotOut)
async def update_plot(
    plot_id: str,
    data: PlotUpdate,
    user: Annotated[User, Depends(get_current_user)],
    use_case: UpdatePlotUseCase = Depends(get_update_plot_use_case),
):
    try:
        plot = await use_case.execute(plot_id, data.model_dump(exclude_none=True), user)
    except InvalidIdError:
        raise HTTPException(404, "Invalid ID")
    except NotFoundError:
        raise HTTPException(404, "Plot not found")
    except DomainError as e:
        raise HTTPException(403, str(e))
    return _to_plot_out(plot)
