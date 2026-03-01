"""
BM25 pre-ranking: быстрый текстовый фильтр по запросу пользователя.
Сужает выборку перед дорогим Jina Reranker.
"""

import re
from rank_bm25 import BM25Okapi


def tokenize_ru(text: str) -> list[str]:
    """Простая токенизация для русского текста."""
    return re.findall(r"[а-яёa-z0-9]+", text.lower())


def bm25_prerank(
    query: str,
    candidates: list[dict],
    top_k: int = 60,
) -> list[dict]:
    """
    Ранжирует candidates по BM25-релевантности к query.
    Возвращает top_k записей с добавленным полем bm25_score.
    """
    if not query or not query.strip():
        # Без текстового запроса — пропускаем BM25, сортируем по total_score
        return sorted(candidates, key=lambda x: x.get("total_score", 0), reverse=True)[:top_k]

    corpus = [
        tokenize_ru(
            f"{c.get('title', '')} {c.get('description', '')}"
        )
        for c in candidates
    ]

    bm25 = BM25Okapi(corpus)
    query_tokens = tokenize_ru(query)
    scores = bm25.get_scores(query_tokens)

    for i, card in enumerate(candidates):
        card["bm25_score"] = round(float(scores[i]), 4)

    ranked = sorted(candidates, key=lambda x: x["bm25_score"], reverse=True)
    return ranked[:top_k]
