from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime

import httpx
from rank_bm25 import BM25Okapi

from domain.repository_interfaces import PlotRepositoryInterface
from infrastructure.config import Settings
from infrastructure.listing import (
    build_plot_filters,
    clamp_page,
    compute_pages,
    normalize_order,
    normalize_sort,
)

logger = logging.getLogger(__name__)

_NUMERIC_SORT_FIELDS = {
    "price", "area_sotki", "total_score", "price_per_sotka",
    "infra_score", "negative_score", "feature_score",
    "combined_score", "jina_score", "bm25_score",
}


def _tokenize_ru(text: str) -> list[str]:
    return re.findall(r"[а-яёa-z0-9]+", text.lower())


def _bm25_rank(query: str, candidates: list[dict], top_k: int | None = None) -> list[dict]:
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


def _compute_combined(candidates: list[dict], alpha: float, beta: float) -> list[dict]:
    if not candidates:
        return candidates

    feature_values = [c.get("feature_score", 0) for c in candidates]
    bm25_values = [c.get("bm25_score", 0) for c in candidates]

    fmin, fmax = min(feature_values), max(feature_values)
    frange = fmax - fmin if fmax - fmin > 1e-9 else 1.0
    bmin, bmax = min(bm25_values), max(bm25_values)
    brange = bmax - bmin if bmax - bmin > 1e-9 else 1.0

    for c in candidates:
        fnorm = (c.get("feature_score", 0) - fmin) / frange
        bnorm = (c.get("bm25_score", 0) - bmin) / brange
        c["combined_score"] = round(alpha * fnorm + beta * bnorm, 4)

    candidates.sort(key=lambda item: item["combined_score"], reverse=True)
    return candidates


@dataclass
class _CacheEntry:
    results: list[dict]
    timestamp: float


class SearchEngine:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._cache: dict[str, _CacheEntry] = {}
        self._cache_ttl = 300
        self._max_cache_size = 50

    def invalidate_cache(self) -> None:
        self._cache.clear()

    def _cache_key(self, query: str, filters: dict | None) -> str:
        payload = {"query": query.lower().strip(), "filters": filters or {}}
        raw = json.dumps(payload, sort_keys=True, ensure_ascii=True, default=str)
        return hashlib.md5(raw.encode()).hexdigest()

    def _evict_expired(self) -> None:
        now = time.time()
        expired = [k for k, v in self._cache.items() if now - v.timestamp > self._cache_ttl]
        for k in expired:
            del self._cache[k]
        while len(self._cache) > self._max_cache_size:
            oldest = min(self._cache, key=lambda k: self._cache[k].timestamp)
            del self._cache[oldest]

    async def _jina_rerank(self, query: str, candidates: list[dict], top_n: int) -> list[dict]:
        if not query or not query.strip():
            return candidates[:top_n]
        if not self._settings.jina_api_key:
            logger.warning("JINA_API_KEY not set, skipping rerank")
            return candidates[:top_n]

        documents: list[str] = []
        for c in candidates:
            doc_text = f"{c.get('title', '')}\n{c.get('description', '')}".lower()
            ft = c.get("features_text", "")
            if ft:
                doc_text += f"\nХарактеристики: {ft}"
            documents.append(doc_text[:4000])

        requested_top_n = min(top_n, len(documents))
        api_top_n = min(requested_top_n, self._settings.search_jina_top_n)

        payload = {
            "model": self._settings.jina_rerank_model,
            "query": query.lower(),
            "documents": documents,
            "top_n": api_top_n,
        }
        headers = {
            "Authorization": f"Bearer {self._settings.jina_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        try:
            timeout = httpx.Timeout(connect=3.0, read=8.0, write=8.0, pool=8.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self._settings.jina_rerank_url, json=payload, headers=headers,
                )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as error:
            logger.error("Jina Reranker error: %s", error)
            return candidates[:requested_top_n]

        scores_by_index: dict[int, float] = {}
        for item in data.get("results", []):
            idx = item.get("index")
            score = item.get("relevance_score")
            if not isinstance(idx, int) or idx < 0 or idx >= len(candidates):
                continue
            try:
                sv = float(score)
            except (TypeError, ValueError):
                continue
            prev = scores_by_index.get(idx)
            scores_by_index[idx] = max(prev, sv) if prev is not None else sv

        sorted_indexes = sorted(scores_by_index, key=lambda i: scores_by_index[i], reverse=True)
        reranked: list[dict] = []
        seen = set()
        for idx in sorted_indexes:
            c = candidates[idx].copy()
            c["jina_score"] = round(scores_by_index[idx], 4)
            reranked.append(c)
            seen.add(idx)
        for idx, c in enumerate(candidates):
            if idx not in seen:
                fc = c.copy()
                fc.setdefault("jina_score", 0.0)
                reranked.append(fc)

        return reranked[:requested_top_n]

    @staticmethod
    def _sort_results(results: list[dict], sort_field: str, sort_order: str) -> list[dict]:
        if not results:
            return []
        normalized_order = normalize_order(sort_order)
        reverse = normalized_order == "desc"

        if sort_field == "relevance":
            return list(results) if reverse else list(reversed(results))

        def _extract(item: dict):
            value = item.get(sort_field)
            if value is None:
                return float("inf") if not reverse else float("-inf")
            if sort_field == "created_at":
                if hasattr(value, "timestamp"):
                    return float(value.timestamp())
                return float("inf") if not reverse else float("-inf")
            try:
                return float(value)
            except (TypeError, ValueError):
                return float("inf") if not reverse else float("-inf")

        def _doc_id(item: dict):
            return str(item.get("_id", ""))

        return sorted(results, key=lambda i: (_extract(i), _doc_id(i)), reverse=reverse)

    async def search(
        self,
        plot_repo: PlotRepositoryInterface,
        query: str,
        page: int = 1,
        page_size: int = 20,
        filters: dict | None = None,
        sort_field: str = "relevance",
        sort_order: str = "desc",
    ) -> tuple[list[dict], int, int, int]:
        query_text = (query or "").strip()
        if not query_text:
            return [], 0, 1, 1

        safe_page = max(1, page)
        safe_page_size = max(1, page_size)
        normalized_sort = normalize_sort(sort_field, has_query=True)
        normalized_order = normalize_order(sort_order)

        mongo_filters = build_plot_filters(filters)
        key = self._cache_key(query_text, mongo_filters)
        now = time.time()

        self._evict_expired()

        entry = self._cache.get(key)
        if entry is not None and (now - entry.timestamp) < self._cache_ttl:
            sorted_results = self._sort_results(entry.results, normalized_sort, normalized_order)
            total = len(sorted_results)
            pages = compute_pages(total, safe_page_size)
            current_page = clamp_page(safe_page, pages)
            offset = (current_page - 1) * safe_page_size
            return sorted_results[offset:offset + safe_page_size], total, pages, current_page

        plots = await plot_repo.find_all(query_filter=mongo_filters or None)
        candidates = [
            {
                "_id": p.id,
                "title": p.title, "description": p.description,
                "price": p.price, "area_sotki": p.area_sotki,
                "price_per_sotka": p.price_per_sotka,
                "location": p.location, "address": p.address,
                "geo_ref": p.geo_ref, "lat": p.lat, "lon": p.lon,
                "url": p.url, "thumbnail": p.thumbnail,
                "images_count": p.images_count, "was_lowered": p.was_lowered,
                "features": p.features, "feature_score": p.feature_score,
                "features_text": p.features_text,
                "infra_score": p.infra_score, "negative_score": p.negative_score,
                "total_score": p.total_score,
                "owner_id": p.owner_id, "owner_name": p.owner_name,
                "created_at": p.created_at, "updated_at": p.updated_at,
                "avito_id": p.avito_id,
            }
            for p in plots
        ]

        if not candidates:
            self._cache[key] = _CacheEntry(results=[], timestamp=now)
            return [], 0, 1, 1

        bm25_ranked = _bm25_rank(query_text, candidates, top_k=len(candidates))
        bm25_ranked = _compute_combined(bm25_ranked, self._settings.alpha, self._settings.beta)

        required = max(safe_page * safe_page_size, safe_page_size)
        headroom = required * 3
        baseline = max(self._settings.search_vector_top_k, safe_page_size * 5)
        rerank_depth = min(len(bm25_ranked), max(baseline, headroom))

        head = bm25_ranked[:rerank_depth]
        tail = bm25_ranked[rerank_depth:]

        reranked_head = await self._jina_rerank(query_text, head, top_n=len(head))
        threshold = self._settings.jina_score_threshold
        if threshold > 0:
            above = [i for i in reranked_head if i.get("jina_score", 0.0) >= threshold]
            below = [i for i in reranked_head if i.get("jina_score", 0.0) < threshold]
            reranked_head = above + below

        ranked_results = reranked_head + tail
        self._cache[key] = _CacheEntry(results=ranked_results, timestamp=now)

        sorted_results = self._sort_results(ranked_results, normalized_sort, normalized_order)
        total = len(sorted_results)
        pages = compute_pages(total, safe_page_size)
        current_page = clamp_page(safe_page, pages)
        offset = (current_page - 1) * safe_page_size
        return sorted_results[offset:offset + safe_page_size], total, pages, current_page
