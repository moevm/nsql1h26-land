"""
Извлечение текстовых фич через Jina Embeddings API.

Локальные модели (sentence-transformers / torch) не используются —
весь расчёт через HTTP-вызов api.jina.ai. Если JINA_API_KEY не задан
или запрос упал — возвращаются нулевые фичи (stub), чтобы backend
не падал.

Фичи считаются только когда входные записи их ещё не содержат
(см. routes/data_io.py:_build_feature_map). Роуты plots.py вызывают
extract_features() на create/update объявления.
"""

import logging

import httpx
import numpy as np

from config import (
    FEATURE_DEFINITIONS,
    FEATURE_LABELS,
    FEATURE_THRESHOLD,
    FEATURE_WEIGHTS,
    JINA_API_KEY,
    JINA_EMBEDDINGS_BATCH,
    JINA_EMBEDDINGS_DIM,
    JINA_EMBEDDINGS_MODEL,
    JINA_EMBEDDINGS_TASK,
    JINA_EMBEDDINGS_TIMEOUT,
    JINA_EMBEDDINGS_URL,
)

logger = logging.getLogger(__name__)

_feature_embs: np.ndarray | None = None


def _encode(texts: list[str]) -> np.ndarray | None:
    """L2-нормализованные эмбеддинги или None при ошибке/отсутствии ключа."""
    if not texts:
        return np.zeros((0, JINA_EMBEDDINGS_DIM), dtype=np.float32)
    if not JINA_API_KEY:
        logger.warning("JINA_API_KEY is empty — feature extraction disabled")
        return None

    headers = {
        "Authorization": f"Bearer {JINA_API_KEY}",
        "Content-Type": "application/json",
    }
    vectors: list[list[float]] = []
    try:
        with httpx.Client(timeout=JINA_EMBEDDINGS_TIMEOUT) as client:
            for start in range(0, len(texts), JINA_EMBEDDINGS_BATCH):
                chunk = texts[start:start + JINA_EMBEDDINGS_BATCH]
                payload = {
                    "model": JINA_EMBEDDINGS_MODEL,
                    "task": JINA_EMBEDDINGS_TASK,
                    "dimensions": JINA_EMBEDDINGS_DIM,
                    "input": chunk,
                }
                resp = client.post(JINA_EMBEDDINGS_URL, headers=headers, json=payload)
                resp.raise_for_status()
                data = sorted(resp.json()["data"], key=lambda x: x["index"])
                vectors.extend(item["embedding"] for item in data)
    except Exception as exc:
        logger.warning("Jina embeddings request failed: %s", exc)
        return None

    arr = np.asarray(vectors, dtype=np.float32)
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return arr / norms


def _get_feature_embeddings() -> np.ndarray | None:
    """Эмбеддинги 15 промптов-фич. Считаются один раз и кэшируются."""
    global _feature_embs
    if _feature_embs is None:
        prompts = [FEATURE_DEFINITIONS[k][0] for k in FEATURE_DEFINITIONS]
        _feature_embs = _encode(prompts)
    return _feature_embs


def _empty_result() -> dict:
    return {
        "features": {fn: 0.0 for fn in FEATURE_DEFINITIONS},
        "feature_score": 0.0,
        "features_text": "",
    }


def _score_from_sims(sims: np.ndarray) -> dict:
    feature_names = list(FEATURE_DEFINITIONS.keys())
    probs = np.clip(sims, 0.0, 1.0)

    features = {fn: round(float(probs[j]), 4) for j, fn in enumerate(feature_names)}

    weights_arr = np.array([FEATURE_WEIGHTS[fn] for fn in feature_names])
    feature_score = round(float(np.dot(probs, weights_arr)), 4)

    found = [
        (feature_names[j], float(probs[j]))
        for j in range(len(feature_names))
        if probs[j] >= FEATURE_THRESHOLD
    ]
    found.sort(key=lambda x: x[1], reverse=True)
    features_text = ", ".join(
        f"{FEATURE_LABELS.get(f, f)} ({p:.0%})" for f, p in found
    )

    return {
        "features": features,
        "feature_score": feature_score,
        "features_text": features_text,
    }


def _prepare_text(title: str, description: str, geo_ref: str = "") -> str:
    text = f"{title} {description} {geo_ref}".lower()
    return text[:1500]


def extract_features(title: str, description: str, geo_ref: str = "") -> dict:
    """Фичи для одного объявления."""
    feature_embs = _get_feature_embeddings()
    if feature_embs is None or feature_embs.size == 0:
        return _empty_result()

    desc_emb = _encode([_prepare_text(title, description, geo_ref)])
    if desc_emb is None or desc_emb.size == 0:
        return _empty_result()

    sims = (desc_emb @ feature_embs.T)[0]
    return _score_from_sims(sims)


def extract_features_batch(records: list[dict]) -> list[dict]:
    """Фичи для батча записей (используется при массовом импорте)."""
    if not records:
        return []

    feature_embs = _get_feature_embeddings()
    if feature_embs is None or feature_embs.size == 0:
        return [_empty_result() for _ in records]

    texts = [
        _prepare_text(rec.get("title", ""), rec.get("description", ""), rec.get("geo_ref", ""))
        for rec in records
    ]
    desc_embs = _encode(texts)
    if desc_embs is None or desc_embs.size == 0:
        return [_empty_result() for _ in records]

    sim_matrix = desc_embs @ feature_embs.T
    return [_score_from_sims(sim_matrix[i]) for i in range(len(records))]
