"""
Сервис поиска: BM25 pre-ranking + feature scoring + Jina Reranker.

Этапы:
  1. Загружаем кандидатов из MongoDB (с фильтрами)
  2. BM25 ранжирование по текстовому запросу
  3. Комбинированный скор: combined = α·feature_norm + β·bm25_norm
  4. Jina Reranker → финальная сортировка по семантической релевантности

Мемоизация: результаты Jina хранятся в памяти (до CACHE_TTL секунд).
При пагинации по закэшированным результатам Jina повторно не вызывается.
"""

import hashlib
import logging
import re
import time
from dataclasses import dataclass

import requests
from motor.motor_asyncio import AsyncIOMotorDatabase
from rank_bm25 import BM25Okapi
from repositories.plot_repository import PlotRepository
from config import (
    SEARCH_VECTOR_TOP_K,
    SEARCH_JINA_TOP_N,
    JINA_SCORE_THRESHOLD,
    JINA_API_KEY, JINA_RERANK_URL, JINA_RERANK_MODEL,
    ALPHA, BETA,
)

logger = logging.getLogger(__name__)

# --------------- BM25 helpers ---------------

def _tokenize_ru(text: str) -> list[str]:
    """Простая токенизация для русского текста."""
    return re.findall(r"[а-яёa-z0-9]+", text.lower())


def _bm25_rank(
    query: str,
    candidates: list[dict],
    top_k: int = SEARCH_VECTOR_TOP_K,
) -> list[dict]:
    """
    BM25 ранжирование кандидатов по текстовому запросу.
    Добавляет поле bm25_score, возвращает top_k.
    """
    if not query or not query.strip():
        for c in candidates:
            c["bm25_score"] = 0.0
        return sorted(candidates, key=lambda x: x.get("feature_score", 0), reverse=True)[:top_k]

    corpus = [
        _tokenize_ru(f"{c.get('title', '')} {c.get('description', '')}")
        for c in candidates
    ]
    bm25 = BM25Okapi(corpus)
    scores = bm25.get_scores(_tokenize_ru(query))

    for i, c in enumerate(candidates):
        c["bm25_score"] = round(float(scores[i]), 4)

    ranked = sorted(candidates, key=lambda x: x["bm25_score"], reverse=True)
    return ranked[:top_k]


def _compute_combined(candidates: list[dict]) -> list[dict]:
    """
    Нормализует feature_score и bm25_score в [0,1], вычисляет
    combined_score = α·feature_norm + β·bm25_norm.
    """
    if not candidates:
        return candidates

    fs_vals = [c.get("feature_score", 0) for c in candidates]
    bm_vals = [c.get("bm25_score", 0) for c in candidates]

    fs_min, fs_max = min(fs_vals), max(fs_vals)
    fs_range = fs_max - fs_min if fs_max - fs_min > 1e-9 else 1.0

    bm_min, bm_max = min(bm_vals), max(bm_vals)
    bm_range = bm_max - bm_min if bm_max - bm_min > 1e-9 else 1.0

    for c in candidates:
        fs_norm = (c.get("feature_score", 0) - fs_min) / fs_range
        bm_norm = (c.get("bm25_score", 0) - bm_min) / bm_range
        c["combined_score"] = round(ALPHA * fs_norm + BETA * bm_norm, 4)

    candidates.sort(key=lambda x: x["combined_score"], reverse=True)
    return candidates


# --------------- In-memory search cache ---------------
CACHE_TTL = 300  # 5 минут
MAX_CACHE_SIZE = 50


@dataclass
class _CacheEntry:
    results: list[dict]
    timestamp: float


_search_cache: dict[str, _CacheEntry] = {}


def _cache_key(query: str, filters: dict | None) -> str:
    raw = query.lower().strip() + "|" + str(sorted((filters or {}).items()))
    return hashlib.md5(raw.encode()).hexdigest()


def _evict_expired() -> None:
    now = time.time()
    expired = [k for k, v in _search_cache.items() if now - v.timestamp > CACHE_TTL]
    for k in expired:
        del _search_cache[k]
    while len(_search_cache) > MAX_CACHE_SIZE:
        oldest_key = min(_search_cache, key=lambda k: _search_cache[k].timestamp)
        del _search_cache[oldest_key]


# --------------- Jina Reranker ---------------

def jina_rerank(
    query: str,
    candidates: list[dict],
    top_n: int = SEARCH_JINA_TOP_N,
) -> list[dict]:
    """Семантический реранкинг через Jina API."""
    if not query or not query.strip():
        return candidates[:top_n]

    if not JINA_API_KEY:
        logger.warning("JINA_API_KEY not set, skipping rerank")
        return candidates[:top_n]

    documents = []
    for c in candidates:
        doc_text = c.get("description", "").lower()
        features_text = c.get("features_text", "")
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
        resp = requests.post(JINA_RERANK_URL, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.RequestException as e:
        logger.error("Jina Reranker error: %s", e)
        return candidates[:top_n]

    results_data = data.get("results", [])
    reranked = []
    for item in results_data:
        idx = item["index"]
        score = item["relevance_score"]
        candidate = candidates[idx].copy()
        candidate["jina_score"] = round(score, 4)
        reranked.append(candidate)

    return reranked[:top_n]


def _apply_threshold(results: list[dict], threshold: float) -> list[dict]:
    if threshold <= 0:
        return results
    return [r for r in results if r.get("jina_score", 1.0) >= threshold]


# --------------- Main search ---------------

async def search_plots(
    db: AsyncIOMotorDatabase,
    query: str,
    page: int = 1,
    page_size: int = SEARCH_JINA_TOP_N,
    min_price: float | None = None,
    max_price: float | None = None,
    min_area: float | None = None,
    max_area: float | None = None,
) -> tuple[list[dict], int, bool]:
    """
    Поисковый пайплайн: BM25 + feature scoring → Jina Reranker.
    Возвращает (page_items, total_cached, can_expand=False).
    """
    mongo_filters: dict = {}
    if min_price is not None:
        mongo_filters["price"] = {"$gte": min_price}
    if max_price is not None:
        mongo_filters.setdefault("price", {})["$lte"] = max_price
    if min_area is not None:
        mongo_filters["area_sotki"] = {"$gte": min_area}
    if max_area is not None:
        mongo_filters.setdefault("area_sotki", {})["$lte"] = max_area

    key = _cache_key(query, mongo_filters)
    offset = (page - 1) * page_size
    needed = offset + page_size
    now = time.time()

    _evict_expired()

    entry = _search_cache.get(key)
    if entry is not None and (now - entry.timestamp) < CACHE_TTL and len(entry.results) >= needed:
        total = len(entry.results)
        return entry.results[offset:offset + page_size], total, False

    # 1. Загружаем кандидатов из БД
    repo = PlotRepository(db)
    candidates = await repo.find_all(query_filter=mongo_filters or None)

    if not candidates:
        _search_cache[key] = _CacheEntry(results=[], timestamp=now)
        return [], 0, False

    # 2. BM25 ранжирование → top K
    bm25_top = _bm25_rank(query, candidates, top_k=SEARCH_VECTOR_TOP_K)

    # 3. Комбинированный скор: α·features + β·bm25
    bm25_top = _compute_combined(bm25_top)

    # 4. Jina реранкирует все кандидаты, затем отсекаем по порогу
    reranked = jina_rerank(query, bm25_top, top_n=len(bm25_top))
    reranked = _apply_threshold(reranked, JINA_SCORE_THRESHOLD)

    _search_cache[key] = _CacheEntry(results=reranked, timestamp=now)

    total = len(reranked)
    return reranked[offset:offset + page_size], total, False
