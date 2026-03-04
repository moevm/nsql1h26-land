"""
Сервис поиска: vector search (MongoDB Atlas HNSW) + Jina Reranker.

Этапы:
  1. Из запроса извлекаем эмбеддинг через sentence-transformers
  2. MongoDB Atlas $vectorSearch → top 100 кандидатов
  3. Jina Reranker → финальная сортировка по семантической релевантности

Мемоизация: результаты Jina хранятся в памяти (до CACHE_TTL секунд).
При пагинации по закэшированным результатам Jina повторно не вызывается.
Повторный вызов происходит только если пользователь листает за пределы кэша.
"""

import hashlib
import logging
import math
import time
from dataclasses import dataclass, field

import numpy as np
import requests
from motor.motor_asyncio import AsyncIOMotorDatabase
from config import (
    COL_PLOTS,
    SEARCH_VECTOR_TOP_K,
    SEARCH_JINA_TOP_N,
    JINA_API_KEY, JINA_RERANK_URL, JINA_RERANK_MODEL,
    ALPHA, BETA,
)
from services.feature_service import compute_query_embedding

logger = logging.getLogger(__name__)

# --------------- In-memory search cache ---------------
CACHE_TTL = 300  # 5 минут
MAX_CACHE_SIZE = 50  # максимум записей


@dataclass
class _CacheEntry:
    results: list[dict]
    timestamp: float
    vector_top_k: int


_search_cache: dict[str, _CacheEntry] = {}


def _cache_key(query: str, filters: dict | None) -> str:
    raw = query.lower().strip() + "|" + str(sorted((filters or {}).items()))
    return hashlib.md5(raw.encode()).hexdigest()


def _evict_expired() -> None:
    """Удаляем просроченные записи и обрезаем до MAX_CACHE_SIZE."""
    now = time.time()
    expired = [k for k, v in _search_cache.items() if now - v.timestamp > CACHE_TTL]
    for k in expired:
        del _search_cache[k]
    # FIFO eviction
    while len(_search_cache) > MAX_CACHE_SIZE:
        oldest_key = min(_search_cache, key=lambda k: _search_cache[k].timestamp)
        del _search_cache[oldest_key]


async def _vector_search_atlas(
    db: AsyncIOMotorDatabase,
    query_embedding: list[float],
    top_k: int = SEARCH_VECTOR_TOP_K,
    filters: dict | None = None,
) -> list[dict]:
    """
    MongoDB Atlas $vectorSearch по HNSW-индексу.
    Требует созданный search-индекс 'vector_index' на поле 'embedding'.
    """
    vs_stage = {
        "$vectorSearch": {
            "index": "vector_index",
            "path": "embedding",
            "queryVector": query_embedding,
            "numCandidates": top_k * 2,
            "limit": top_k,
        }
    }
    if filters:
        vs_stage["$vectorSearch"]["filter"] = filters

    pipeline = [
        vs_stage,
        {"$addFields": {"search_score": {"$meta": "vectorSearchScore"}}},
        {"$project": {"embedding": 0}},
    ]

    cursor = db[COL_PLOTS].aggregate(pipeline)
    return await cursor.to_list(length=top_k)


async def _vector_search_fallback(
    db: AsyncIOMotorDatabase,
    query_embedding: list[float],
    top_k: int = SEARCH_VECTOR_TOP_K,
    filters: dict | None = None,
) -> list[dict]:
    """
    Фолбэк: загружаем все эмбеддинги, считаем косинусное сходство в Python.
    Используется когда Atlas vector search недоступен.
    """
    match_stage = filters or {}
    cursor = db[COL_PLOTS].find(match_stage, {"embedding": 1, "_id": 1})
    docs = await cursor.to_list(length=None)

    if not docs:
        return []

    ids = [d["_id"] for d in docs]
    embeddings = np.array([d.get("embedding", [0] * 384) for d in docs])
    query_vec = np.array(query_embedding)

    # cosine similarity (вектора уже нормализованы)
    scores = embeddings @ query_vec
    top_indices = np.argsort(scores)[::-1][:top_k]

    top_ids = [ids[i] for i in top_indices]
    top_scores = {str(ids[i]): float(scores[i]) for i in top_indices}

    # загружаем полные документы
    cursor = db[COL_PLOTS].find({"_id": {"$in": top_ids}}, {"embedding": 0})
    full_docs = await cursor.to_list(length=top_k)

    for doc in full_docs:
        doc["search_score"] = top_scores.get(str(doc["_id"]), 0)

    full_docs.sort(key=lambda x: x.get("search_score", 0), reverse=True)
    return full_docs


async def vector_search(
    db: AsyncIOMotorDatabase,
    query_embedding: list[float],
    top_k: int = SEARCH_VECTOR_TOP_K,
    filters: dict | None = None,
) -> list[dict]:
    """Пробует Atlas $vectorSearch, при ошибке — фолбэк."""
    try:
        results = await _vector_search_atlas(db, query_embedding, top_k, filters)
        if results:
            logger.info("Atlas $vectorSearch returned %d docs", len(results))
            return results
    except Exception as e:
        logger.warning("Atlas $vectorSearch failed (%s), using fallback", e)

    return await _vector_search_fallback(db, query_embedding, top_k, filters)


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


async def search_plots(
    db: AsyncIOMotorDatabase,
    query: str,
    page: int = 1,
    page_size: int = SEARCH_JINA_TOP_N,
    min_price: float | None = None,
    max_price: float | None = None,
    min_area: float | None = None,
    max_area: float | None = None,
) -> tuple[list[dict], int]:
    """
    Полный поисковый пайплайн с мемоизацией:
      1. Проверяем кэш — если уже считали Jina для (query, filters), берём оттуда
      2. Если кэш пуст или недостаточно результатов — vector search + Jina rerank
      3. Возвращаем (page_items, total_cached)
    """
    # Собираем MongoDB-фильтры
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

    # Кэш валиден и хватает результатов → возвращаем срез
    if (
        entry is not None
        and (now - entry.timestamp) < CACHE_TTL
        and (len(entry.results) >= needed or entry.vector_top_k >= needed)
    ):
        total = len(entry.results)
        return entry.results[offset:offset + page_size], total

    # Нужен (пере)расчёт
    top_k = max(SEARCH_VECTOR_TOP_K, needed + 50)

    query_embedding = compute_query_embedding(query)

    candidates = await vector_search(
        db, query_embedding, top_k=top_k,
        filters=mongo_filters if mongo_filters else None,
    )

    if not candidates:
        _search_cache[key] = _CacheEntry(results=[], timestamp=now, vector_top_k=top_k)
        return [], 0

    # Jina реранкирует ВСЕ кандидаты (до 100–200), не обрезая
    reranked = jina_rerank(query, candidates, top_n=len(candidates))

    _search_cache[key] = _CacheEntry(results=reranked, timestamp=now, vector_top_k=top_k)

    total = len(reranked)
    return reranked[offset:offset + page_size], total
