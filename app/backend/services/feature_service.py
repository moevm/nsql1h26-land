"""
Извлечение текстовых фич через sentence-transformers (локально).

Если sentence-transformers не установлен — работает в stub-режиме:
  - эмбеддинги = нулевой вектор
  - фичи = 0.0
"""

import logging
import numpy as np

from config import (
    EMBEDDINGS_MODEL_NAME,
    EMBEDDING_DIM,
    FEATURE_DEFINITIONS,
    FEATURE_WEIGHTS,
    FEATURE_THRESHOLD,
    FEATURE_LABELS,
)

logger = logging.getLogger(__name__)

# --- Попытка импортировать sentence-transformers ---
try:
    from sentence_transformers import SentenceTransformer
    _HAS_ST = True
except ImportError:
    _HAS_ST = False
    logger.warning("sentence-transformers not installed — using stub (zero embeddings)")

_model = None
_feature_embs: np.ndarray | None = None


def _get_model():
    global _model
    if not _HAS_ST:
        return None
    if _model is None:
        logger.info("Loading model '%s'...", EMBEDDINGS_MODEL_NAME)
        _model = SentenceTransformer(EMBEDDINGS_MODEL_NAME)
    return _model


def _get_feature_embeddings() -> np.ndarray:
    global _feature_embs
    if _feature_embs is None:
        model = _get_model()
        if model is None:
            _feature_embs = np.zeros((len(FEATURE_DEFINITIONS), EMBEDDING_DIM))
        else:
            feature_texts = [FEATURE_DEFINITIONS[k][0] for k in FEATURE_DEFINITIONS]
            _feature_embs = model.encode(feature_texts, normalize_embeddings=True, show_progress_bar=False)
    return _feature_embs


def _zero_embedding() -> list[float]:
    return [0.0] * EMBEDDING_DIM


def compute_embedding(text: str) -> list[float]:
    """Вычисляет эмбеддинг текста для HNSW-индекса."""
    model = _get_model()
    if model is None:
        return _zero_embedding()
    emb = model.encode([text[:1500]], normalize_embeddings=True, show_progress_bar=False)
    return emb[0].tolist()


def compute_query_embedding(query: str) -> list[float]:
    """Вычисляет эмбеддинг поискового запроса."""
    return compute_embedding(query.lower())


def _empty_result() -> dict:
    feature_names = list(FEATURE_DEFINITIONS.keys())
    return {
        "features": {fn: 0.0 for fn in feature_names},
        "feature_score": 0.0,
        "features_text": "",
        "embedding": _zero_embedding(),
    }


def extract_features(title: str, description: str, geo_ref: str = "") -> dict:
    """
    Извлекает фичи из описания объявления.

    Возвращает:
        {
            "features": {"has_gas": 0.42, ...},
            "feature_score": 0.35,
            "features_text": "газ (42%), ...",
            "embedding": [0.1, 0.2, ...]
        }
    """
    model = _get_model()
    if model is None:
        return _empty_result()

    feature_embs = _get_feature_embeddings()

    text = f"{title} {description} {geo_ref}".lower()
    desc_emb = model.encode([text[:1500]], normalize_embeddings=True, show_progress_bar=False)

    feature_names = list(FEATURE_DEFINITIONS.keys())
    sims = (desc_emb @ feature_embs.T)[0]
    probs = np.clip(sims, 0.0, 1.0)

    features = {}
    for j, feat_name in enumerate(feature_names):
        features[feat_name] = round(float(probs[j]), 4)

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

    embedding = desc_emb[0].tolist()

    return {
        "features": features,
        "feature_score": feature_score,
        "features_text": features_text,
        "embedding": embedding,
    }


def extract_features_batch(records: list[dict]) -> list[dict]:
    """
    Извлекает фичи для батча записей.
    """
    model = _get_model()
    if model is None:
        return [_empty_result() for _ in records]

    feature_embs = _get_feature_embeddings()
    feature_names = list(FEATURE_DEFINITIONS.keys())
    weights_arr = np.array([FEATURE_WEIGHTS[fn] for fn in feature_names])

    texts = []
    for rec in records:
        text = f"{rec.get('title', '')} {rec.get('description', '')} {rec.get('geo_ref', '')}".lower()
        texts.append(text[:1500])

    desc_embs = model.encode(texts, normalize_embeddings=True, show_progress_bar=True, batch_size=128)
    sim_matrix = desc_embs @ feature_embs.T

    results = []
    for i in range(len(records)):
        probs = np.clip(sim_matrix[i], 0.0, 1.0)

        features = {}
        for j, feat_name in enumerate(feature_names):
            features[feat_name] = round(float(probs[j]), 4)

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

        results.append({
            "features": features,
            "feature_score": feature_score,
            "features_text": features_text,
            "embedding": desc_embs[i].tolist(),
        })

    return results
