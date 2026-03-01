"""
Извлечение текстовых фич из описаний через sentence-transformers (локально).

Кодируем описание и каждую фичу-описание через multilingual модель,
считаем cosine similarity → получаем вероятность 0..1.
"""

import numpy as np
from sentence_transformers import SentenceTransformer
from config import (
    EMBEDDINGS_MODEL_NAME,
    FEATURE_DEFINITIONS,
    FEATURE_WEIGHTS,
    FEATURE_THRESHOLD,
)

# Глобальная модель (ленивая загрузка)
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    """Загружает модель один раз и кеширует в глобальной переменной."""
    global _model
    if _model is None:
        print(f"       Загрузка модели '{EMBEDDINGS_MODEL_NAME}'...")
        _model = SentenceTransformer(EMBEDDINGS_MODEL_NAME)
    return _model


# Человекочитаемые лейблы для вывода
FEATURE_LABELS = {
    "has_gas": "газ",
    "has_electricity": "электричество",
    "has_water": "водоснабжение",
    "has_sewage": "канализация",
    "has_house": "дом/постройки",
    "is_izhs": "ИЖС",
    "is_snt": "СНТ/ДНП",
    "is_quiet": "тихое место",
    "has_forest": "лес рядом",
    "near_river": "водоём рядом",
    "has_road": "хороший подъезд",
    "has_fence": "огорожен",
    "flat_terrain": "ровный участок",
    "has_communications": "коммуникации подведены",
    "documents_ready": "документы готовы",
}


def enrich_with_features(records: list[dict]) -> list[dict]:
    """
    Для каждой записи:
      1. Кодируем описание через sentence-transformers (локально)
      2. Считаем cosine similarity с каждой фичей → вероятность 0..1
      3. feature_score = взвешенная сумма (вероятность × вес)
      4. features_text = фичи выше порога
    """
    model = _get_model()

    # --- Кодируем описания фич ---
    feature_names = list(FEATURE_DEFINITIONS.keys())
    feature_texts = [FEATURE_DEFINITIONS[k][0] for k in feature_names]

    print(f"       Кодирование {len(feature_texts)} фич...")
    feature_embs = model.encode(feature_texts, normalize_embeddings=True, show_progress_bar=False)

    # --- Собираем тексты описаний ---
    descriptions = []
    for rec in records:
        text = f"{rec.get('title', '')} {rec.get('description', '')} {rec.get('geo_ref', '')}"
        descriptions.append(text[:1500])

    print(f"       Кодирование {len(descriptions)} описаний (локальная модель)...")
    desc_embs = model.encode(descriptions, normalize_embeddings=True,
                             show_progress_bar=True, batch_size=128)

    # --- Cosine similarity матрица: (n_records, n_features) ---
    # Векторы уже нормализованы → dot product = cosine similarity
    sim_matrix = desc_embs @ feature_embs.T  # shape: (n_records, n_features)

    # --- Заполняем записи ---
    weights_arr = np.array([FEATURE_WEIGHTS[fn] for fn in feature_names])

    for i, rec in enumerate(records):
        sims = sim_matrix[i]  # (n_features,)
        probs = np.clip(sims, 0.0, 1.0)

        # Запись вероятностей по каждой фиче
        for j, feat_name in enumerate(feature_names):
            rec[feat_name] = round(float(probs[j]), 4)

        # Взвешенный score
        rec["feature_score"] = round(float(np.dot(probs, weights_arr)), 4)

        # Текстовые фичи выше порога
        found = [(feature_names[j], float(probs[j]))
                 for j in range(len(feature_names))
                 if probs[j] >= FEATURE_THRESHOLD]
        found.sort(key=lambda x: x[1], reverse=True)

        rec["features_text"] = ", ".join(
            f"{FEATURE_LABELS.get(f, f)} ({p:.0%})"
            for f, p in found
        )

    return records
