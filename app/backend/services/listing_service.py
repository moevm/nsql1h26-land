import math
from typing import Any

ORDER_PATTERN = "^(asc|desc)$"
SORT_PATTERN = "^(relevance|created_at|price|area_sotki|total_score|price_per_sotka|infra_score|negative_score|feature_score)$"

SORT_FIELDS = {
    "relevance",
    "created_at",
    "price",
    "area_sotki",
    "total_score",
    "price_per_sotka",
    "infra_score",
    "negative_score",
    "feature_score",
}

ORDER_VALUES = {"asc", "desc"}


def normalize_order(order: str | None) -> str:
    if order in ORDER_VALUES:
        return order
    return "desc"


def normalize_sort(sort_field: str | None, *, has_query: bool) -> str:
    fallback = "relevance" if has_query else "created_at"
    if sort_field not in SORT_FIELDS:
        return fallback
    if sort_field == "relevance" and not has_query:
        return "created_at"
    return sort_field


def build_sort_spec(sort_field: str, sort_order: str) -> list[tuple[str, int]]:
    direction = 1 if normalize_order(sort_order) == "asc" else -1
    # relevance нельзя отсортировать в MongoDB, поэтому в БД всегда fallback
    if sort_field == "relevance":
        sort_field = "created_at"
    return [(sort_field, direction), ("_id", direction)]


def compute_pages(total: int, page_size: int) -> int:
    if total <= 0:
        return 1
    safe_page_size = max(1, page_size)
    return max(1, math.ceil(total / safe_page_size))


def clamp_page(page: int, pages: int) -> int:
    safe_pages = max(1, pages)
    return min(max(1, page), safe_pages)


def _to_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def _apply_range_filter(
    target: dict,
    payload: dict,
    *,
    field: str,
    min_key: str,
    max_key: str,
) -> None:
    min_value = _to_number(payload.get(min_key))
    max_value = _to_number(payload.get(max_key))

    if min_value is None and max_value is None:
        return
    if min_value is not None and max_value is not None and min_value > max_value:
        min_value, max_value = max_value, min_value

    field_filter: dict = {}
    if min_value is not None:
        field_filter["$gte"] = min_value
    if max_value is not None:
        field_filter["$lte"] = max_value
    if field_filter:
        target[field] = field_filter


def _apply_min_filter(target: dict, payload: dict, *, source_key: str, target_field: str) -> None:
    min_value = _to_number(payload.get(source_key))
    if min_value is not None:
        target[target_field] = {"$gte": min_value}


def _extract_location_filter(payload: dict) -> dict | None:
    location = payload.get("location")
    if not isinstance(location, str):
        return None
    normalized_location = location.strip()
    if not normalized_location:
        return None
    return {"$regex": normalized_location, "$options": "i"}


def build_plot_filters(filters: dict | None) -> dict:
    payload = filters or {}
    mongo_filters: dict = {}

    _apply_range_filter(
        mongo_filters,
        payload,
        field="price",
        min_key="min_price",
        max_key="max_price",
    )
    _apply_range_filter(
        mongo_filters,
        payload,
        field="area_sotki",
        min_key="min_area",
        max_key="max_area",
    )
    _apply_range_filter(
        mongo_filters,
        payload,
        field="price_per_sotka",
        min_key="min_price_per_sotka",
        max_key="max_price_per_sotka",
    )

    _apply_min_filter(mongo_filters, payload, source_key="min_score", target_field="total_score")
    _apply_min_filter(mongo_filters, payload, source_key="min_infra", target_field="infra_score")
    _apply_min_filter(mongo_filters, payload, source_key="min_feature", target_field="feature_score")

    location_filter = _extract_location_filter(payload)
    if location_filter is not None:
        mongo_filters["location"] = location_filter

    return mongo_filters
