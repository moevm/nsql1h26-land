"""
Сервис поиска: BM25 pre-ranking + feature scoring + Jina Reranker.

Ключевые принципы:
  1. Единые фильтры и сортировки с обычным листингом
  2. Стабильная пагинация (deterministic order + page clamp)
  3. Кэш ранжированных результатов по (query + filters)
"""

import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from rank_bm25 import BM25Okapi

from config import (
    ALPHA,
    BETA,
    JINA_API_KEY,
    JINA_RERANK_MODEL,
    JINA_RERANK_URL,
    JINA_SCORE_THRESHOLD,
    SEARCH_VECTOR_TOP_K,
)
from repositories.plot_repository import PlotRepository
from services.listing_service import (
    build_plot_filters,
    clamp_page,
    compute_pages,
    normalize_order,
    normalize_sort,
)

logger = logging.getLogger(__name__)

_NUMERIC_SORT_FIELDS = {
    "price",
    "area_sotki",
    "total_score",
    "price_per_sotka",
    "infra_score",
    "negative_score",
    "feature_score",
    "combined_score",
    "jina_score",
    "bm25_score",
}

# --------------- BM25 helpers ---------------


def _tokenize_ru(text: str) -> list[str]:
    """Простая токенизация для русского текста."""
    return re.findall(r"[а-яёa-z0-9]+", text.lower())


def _bm25_rank(
    query: str,
    candidates: list[dict],
    top_k: int | None = SEARCH_VECTOR_TOP_K,
) -> list[dict]:
    """
    BM25 ранжирование кандидатов по текстовому запросу.
    Добавляет поле bm25_score, возвращает top_k (или все при top_k=None).
    """
    if not query or not query.strip():
        for candidate in candidates:
            candidate["bm25_score"] = 0.0
        ranked = sorted(candidates, key=lambda item: item.get("feature_score", 0), reverse=True)
        return ranked if top_k is None else ranked[:top_k]

    corpus = [
        _tokenize_ru(f"{candidate.get('title', '')} {candidate.get('description', '')}")
        for candidate in candidates
    ]
    bm25 = BM25Okapi(corpus)
    scores = bm25.get_scores(_tokenize_ru(query))

    for index, candidate in enumerate(candidates):
        candidate["bm25_score"] = round(float(scores[index]), 4)

    ranked = sorted(candidates, key=lambda item: item["bm25_score"], reverse=True)
    return ranked if top_k is None else ranked[:top_k]


def _compute_combined(candidates: list[dict]) -> list[dict]:
    """
    Нормализует feature_score и bm25_score в [0,1] и вычисляет
    combined_score = alpha*feature_norm + beta*bm25_norm.
    """
    if not candidates:
        return candidates

    feature_values = [candidate.get("feature_score", 0) for candidate in candidates]
    bm25_values = [candidate.get("bm25_score", 0) for candidate in candidates]

    feature_min, feature_max = min(feature_values), max(feature_values)
    feature_range = feature_max - feature_min if feature_max - feature_min > 1e-9 else 1.0

    bm25_min, bm25_max = min(bm25_values), max(bm25_values)
    bm25_range = bm25_max - bm25_min if bm25_max - bm25_min > 1e-9 else 1.0

    for candidate in candidates:
        feature_norm = (candidate.get("feature_score", 0) - feature_min) / feature_range
        bm25_norm = (candidate.get("bm25_score", 0) - bm25_min) / bm25_range
        candidate["combined_score"] = round(ALPHA * feature_norm + BETA * bm25_norm, 4)

    candidates.sort(key=lambda item: item["combined_score"], reverse=True)
    return candidates


# --------------- In-memory search cache ---------------
CACHE_TTL = 300  # 5 минут
MAX_CACHE_SIZE = 50


@dataclass
class _CacheEntry:
    results: list[dict]
    timestamp: float


_search_cache: dict[str, _CacheEntry] = {}


def invalidate_search_cache() -> None:
    """Очищает кэш поиска после изменения данных объявлений."""
    _search_cache.clear()


def _cache_key(query: str, filters: dict | None) -> str:
    payload = {
        "query": query.lower().strip(),
        "filters": filters or {},
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=True, default=str)
    return hashlib.md5(raw.encode()).hexdigest()


def _evict_expired() -> None:
    now = time.time()
    expired_keys = [key for key, value in _search_cache.items() if now - value.timestamp > CACHE_TTL]
    for key in expired_keys:
        del _search_cache[key]

    while len(_search_cache) > MAX_CACHE_SIZE:
        oldest_key = min(_search_cache, key=lambda key: _search_cache[key].timestamp)
        del _search_cache[oldest_key]


# --------------- Jina Reranker ---------------


async def jina_rerank(
    query: str,
    candidates: list[dict],
    top_n: int,
) -> list[dict]:
    """Семантический реранкинг через Jina API."""
    if not query or not query.strip():
        return candidates[:top_n]

    if not JINA_API_KEY:
        logger.warning("JINA_API_KEY not set, skipping rerank")
        return candidates[:top_n]

    documents: list[str] = []
    for candidate in candidates:
        doc_text = f"{candidate.get('title', '')}\n{candidate.get('description', '')}".lower()
        features_text = candidate.get("features_text", "")
        if features_text:
            doc_text += f"\nХарактеристики: {features_text}"
        documents.append(doc_text[:4000])

    payload = {
        "model": JINA_RERANK_MODEL,
        "query": query.lower(),
        "documents": documents,
        "top_n": min(top_n, len(documents)),
    }
    headers = {
        "Authorization": f"Bearer {JINA_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                JINA_RERANK_URL,
                json=payload,
                headers=headers,
            )
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPError as error:
        logger.error("Jina Reranker error: %s", error)
        return candidates[:top_n]

    reranked: list[dict] = []
    for item in data.get("results", []):
        index = item["index"]
        score = item["relevance_score"]
        candidate = candidates[index].copy()
        candidate["jina_score"] = round(float(score), 4)
        reranked.append(candidate)

    return reranked[:top_n]


def _prioritize_by_threshold(results: list[dict], threshold: float) -> list[dict]:
    """
    Не удаляет документы ниже порога, а только переносит их в хвост.
    Это сохраняет корректные total/pages и стабильную пагинацию.
    """
    if threshold <= 0:
        return results

    above = [item for item in results if item.get("jina_score", 0.0) >= threshold]
    below = [item for item in results if item.get("jina_score", 0.0) < threshold]
    return above + below


def _stable_doc_id(item: dict) -> str:
    value = item.get("_id")
    return str(value) if value is not None else ""


def _default_sort_value(sort_field: str, sort_order: str):
    if sort_field in _NUMERIC_SORT_FIELDS:
        return float("inf") if sort_order == "asc" else float("-inf")
    if sort_field == "created_at":
        return float("inf") if sort_order == "asc" else float("-inf")
    return "\uffff" if sort_order == "asc" else ""


def _extract_sort_value(item: dict, sort_field: str, sort_order: str):
    value = item.get(sort_field)
    if value is None:
        return _default_sort_value(sort_field, sort_order)

    if sort_field == "created_at":
        if hasattr(value, "timestamp"):
            return float(value.timestamp())
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
            except ValueError:
                return _default_sort_value(sort_field, sort_order)
        return _default_sort_value(sort_field, sort_order)

    if sort_field in _NUMERIC_SORT_FIELDS:
        try:
            return float(value)
        except (TypeError, ValueError):
            return _default_sort_value(sort_field, sort_order)

    return str(value).lower()


def _sort_results(results: list[dict], sort_field: str, sort_order: str) -> list[dict]:
    """Сортирует результаты по полю каталога или по релевантности."""
    if not results:
        return []

    normalized_order = normalize_order(sort_order)
    reverse = normalized_order == "desc"

    if sort_field == "relevance":
        return list(results) if reverse else list(reversed(results))

    return sorted(
        results,
        key=lambda item: (
            _extract_sort_value(item, sort_field, normalized_order),
            _stable_doc_id(item),
        ),
        reverse=reverse,
    )


def _compute_rerank_depth(total_candidates: int, page: int, page_size: int) -> int:
    required = max(page * page_size, page_size)
    headroom = required * 3
    baseline = max(SEARCH_VECTOR_TOP_K, page_size * 5)
    return min(total_candidates, max(baseline, headroom))


# --------------- Main search ---------------


async def search_plots(
    db: AsyncIOMotorDatabase,
    query: str,
    page: int = 1,
    page_size: int = 20,
    filters: dict | None = None,
    sort_field: str = "relevance",
    sort_order: str = "desc",
) -> tuple[list[dict], int, int, int]:
    """
    Поисковый пайплайн: BM25 + feature scoring + Jina Reranker.
    Возвращает (page_items, total, pages, current_page).
    """
    query_text = (query or "").strip()
    if not query_text:
        return [], 0, 1, 1

    safe_page = max(1, page)
    safe_page_size = max(1, page_size)
    normalized_sort = normalize_sort(sort_field, has_query=True)
    normalized_order = normalize_order(sort_order)

    mongo_filters = build_plot_filters(filters)
    key = _cache_key(query_text, mongo_filters)
    now = time.time()

    _evict_expired()

    entry = _search_cache.get(key)
    if entry is not None and (now - entry.timestamp) < CACHE_TTL:
        sorted_results = _sort_results(entry.results, normalized_sort, normalized_order)
        total = len(sorted_results)
        pages = compute_pages(total, safe_page_size)
        current_page = clamp_page(safe_page, pages)
        offset = (current_page - 1) * safe_page_size
        return sorted_results[offset:offset + safe_page_size], total, pages, current_page

    repo = PlotRepository(db)
    candidates = await repo.find_all(query_filter=mongo_filters or None)

    if not candidates:
        _search_cache[key] = _CacheEntry(results=[], timestamp=now)
        return [], 0, 1, 1

    # 1) BM25 ранжирование по всей отфильтрованной выборке
    bm25_ranked = _bm25_rank(query_text, candidates, top_k=len(candidates))

    # 2) Комбинированный скор: alpha*feature + beta*bm25
    bm25_ranked = _compute_combined(bm25_ranked)

    # 3) Реранжим только "голову" списка с запасом под текущую/следующие страницы
    rerank_depth = _compute_rerank_depth(len(bm25_ranked), safe_page, safe_page_size)
    head = bm25_ranked[:rerank_depth]
    tail = bm25_ranked[rerank_depth:]

    reranked_head = await jina_rerank(query_text, head, top_n=len(head))
    reranked_head = _prioritize_by_threshold(reranked_head, JINA_SCORE_THRESHOLD)
    ranked_results = reranked_head + tail

    _search_cache[key] = _CacheEntry(results=ranked_results, timestamp=now)

    sorted_results = _sort_results(ranked_results, normalized_sort, normalized_order)
    total = len(sorted_results)
    pages = compute_pages(total, safe_page_size)
    current_page = clamp_page(safe_page, pages)
    offset = (current_page - 1) * safe_page_size
    return sorted_results[offset:offset + safe_page_size], total, pages, current_page
