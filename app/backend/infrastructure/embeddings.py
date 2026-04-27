from __future__ import annotations

import logging

import httpx
import numpy as np

from domain.value_objects import FeatureResult
from infrastructure.config import Settings

logger = logging.getLogger(__name__)

_feature_embs: np.ndarray | None = None


class JinaEmbeddingClient:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._api_key = settings.jina_api_key
        self._model = settings.jina_embeddings_model
        self._dim = settings.jina_embeddings_dim
        self._batch_size = settings.jina_embeddings_batch
        self._timeout = settings.jina_embeddings_timeout
        self._task = settings.jina_embeddings_task
        self._url = settings.jina_embeddings_url
        self._threshold = settings.feature_threshold
        self._definitions = settings.feature_definitions
        self._weights = settings.feature_weights
        self._labels = settings.feature_labels

    def _encode(self, texts: list[str]) -> np.ndarray | None:
        if not texts:
            return np.zeros((0, self._dim), dtype=np.float32)
        if not self._api_key:
            logger.warning("JINA_API_KEY is empty — feature extraction disabled")
            return None

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        vectors: list[list[float]] = []
        try:
            with httpx.Client(timeout=self._timeout) as client:
                for start in range(0, len(texts), self._batch_size):
                    chunk = texts[start:start + self._batch_size]
                    payload = {
                        "model": self._model,
                        "task": self._task,
                        "dimensions": self._dim,
                        "input": chunk,
                    }
                    resp = client.post(self._url, headers=headers, json=payload)
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

    def _get_feature_embeddings(self) -> np.ndarray | None:
        global _feature_embs
        if _feature_embs is None:
            prompts = [self._definitions[k][0] for k in self._definitions]
            _feature_embs = self._encode(prompts)
        return _feature_embs

    def _empty_result(self) -> FeatureResult:
        return FeatureResult(
            features={fn: 0.0 for fn in self._definitions},
            feature_score=0.0,
            features_text="",
        )

    def _score_from_sims(self, sims: np.ndarray) -> FeatureResult:
        feature_names = list(self._definitions.keys())
        probs = np.clip(sims, 0.0, 1.0)

        features = {fn: round(float(probs[j]), 4) for j, fn in enumerate(feature_names)}

        weights_arr = np.array([self._weights[fn] for fn in feature_names])
        feature_score = round(float(np.dot(probs, weights_arr)), 4)

        found = [
            (feature_names[j], float(probs[j]))
            for j in range(len(feature_names))
            if probs[j] >= self._threshold
        ]
        found.sort(key=lambda x: x[1], reverse=True)
        features_text = ", ".join(
            f"{self._labels.get(f, f)} ({p:.0%})" for f, p in found
        )

        return FeatureResult(
            features=features,
            feature_score=feature_score,
            features_text=features_text,
        )

    def _prepare_text(self, title: str, description: str, geo_ref: str = "") -> str:
        text = f"{title} {description} {geo_ref}".lower()
        return text[:1500]

    def extract_features(self, title: str, description: str, geo_ref: str = "") -> FeatureResult:
        feature_embs = self._get_feature_embeddings()
        if feature_embs is None or feature_embs.size == 0:
            return self._empty_result()

        desc_emb = self._encode([self._prepare_text(title, description, geo_ref)])
        if desc_emb is None or desc_emb.size == 0:
            return self._empty_result()

        sims = (desc_emb @ feature_embs.T)[0]
        return self._score_from_sims(sims)

    def extract_features_batch(self, records: list[dict]) -> list[FeatureResult]:
        if not records:
            return []

        feature_embs = self._get_feature_embeddings()
        if feature_embs is None or feature_embs.size == 0:
            return [self._empty_result() for _ in records]

        texts = [
            self._prepare_text(rec.get("title", ""), rec.get("description", ""), rec.get("geo_ref", ""))
            for rec in records
        ]
        desc_embs = self._encode(texts)
        if desc_embs is None or desc_embs.size == 0:
            return [self._empty_result() for _ in records]

        sim_matrix = desc_embs @ feature_embs.T
        return [self._score_from_sims(sim_matrix[i]) for i in range(len(records))]
