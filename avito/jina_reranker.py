"""
Jina Reranker: семантический реранкинг финального топа.
Cross-encoder модель — принимает сырой текст, эмбеддинги не нужны.
"""

import requests
from config import JINA_API_KEY, JINA_RERANK_URL, JINA_RERANK_MODEL


def jina_rerank(
    query: str,
    candidates: list[dict],
    top_n: int = 20,
) -> list[dict]:
    """
    Переранжирует candidates по семантической релевантности к query.
    Использует Jina Reranker API.

    Возвращает top_n записей с добавленным полем jina_score.
    """
    if not query or not query.strip():
        return candidates[:top_n]

    if not JINA_API_KEY:
        print("[WARN] Jina API key не задан, пропускаем реранкинг")
        return candidates[:top_n]

    # Собираем документы: описание + текстовые фичи
    documents = []
    for c in candidates:
        doc_text = c.get("description", "")
        features_text = c.get("features_text", "")
        if features_text:
            doc_text += f"\nХарактеристики: {features_text}"
        documents.append(doc_text[:4000])  # Jina лимит

    payload = {
        "model": JINA_RERANK_MODEL,
        "query": query,
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
        print(f"[ERROR] Jina Reranker: {e}")
        # Fallback: возвращаем без реранкинга
        for c in candidates:
            c["jina_score"] = None
        return candidates[:top_n]

    # Маппим результаты обратно
    results = data.get("results", [])
    reranked = []
    for item in results:
        idx = item["index"]
        score = item["relevance_score"]
        candidate = candidates[idx].copy()
        candidate["jina_score"] = round(score, 4)
        reranked.append(candidate)

    return reranked[:top_n]
