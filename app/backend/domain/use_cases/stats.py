from __future__ import annotations

from collections import Counter
from typing import Any

from domain.repository_interfaces import PlotRepositoryInterface


NUMERIC_BUCKETS: dict[str, list[tuple[float, float, str]]] = {
    "price": [
        (0, 1_000_000, "< 1 млн"),
        (1_000_000, 3_000_000, "1–3 млн"),
        (3_000_000, 5_000_000, "3–5 млн"),
        (5_000_000, 10_000_000, "5–10 млн"),
        (10_000_000, 20_000_000, "10–20 млн"),
        (20_000_000, float("inf"), "20+ млн"),
    ],
    "area_sotki": [
        (0, 6, "< 6 сот."),
        (6, 10, "6–10 сот."),
        (10, 15, "10–15 сот."),
        (15, 30, "15–30 сот."),
        (30, float("inf"), "30+ сот."),
    ],
    "price_per_sotka": [
        (0, 100_000, "< 100к"),
        (100_000, 250_000, "100–250к"),
        (250_000, 500_000, "250–500к"),
        (500_000, 1_000_000, "500к–1М"),
        (1_000_000, float("inf"), "1М+"),
    ],
    "total_score": [
        (0, 0.2, "0.0–0.2"),
        (0.2, 0.4, "0.2–0.4"),
        (0.4, 0.6, "0.4–0.6"),
        (0.6, 0.8, "0.6–0.8"),
        (0.8, 1.01, "0.8–1.0"),
    ],
    "infra_score": [
        (0, 0.2, "0.0–0.2"),
        (0.2, 0.4, "0.2–0.4"),
        (0.4, 0.6, "0.4–0.6"),
        (0.6, 0.8, "0.6–0.8"),
        (0.8, 1.01, "0.8–1.0"),
    ],
    "feature_score": [
        (0, 0.2, "0.0–0.2"),
        (0.2, 0.4, "0.2–0.4"),
        (0.4, 0.6, "0.4–0.6"),
        (0.6, 0.8, "0.6–0.8"),
        (0.8, 1.01, "0.8–1.0"),
    ],
}

BOOLEAN_FEATURES = {
    "is_izhs": "ИЖС",
    "is_snt": "СНТ/ДНП",
    "has_gas": "газ",
    "has_electricity": "электричество",
    "has_water": "вода",
    "has_house": "дом",
    "has_road": "хороший подъезд",
    "documents_ready": "документы",
}

DIMENSION_LABELS = {
    "price": "Цена",
    "area_sotki": "Площадь",
    "price_per_sotka": "Цена за сотку",
    "total_score": "Общий скор",
    "infra_score": "Скор инфры",
    "feature_score": "Скор фич",
    "location": "Район",
    **{k: v for k, v in BOOLEAN_FEATURES.items()},
}

DIMENSIONS = list(DIMENSION_LABELS.keys())
FEATURE_THRESHOLD = 0.6


def _bucket_for(dim: str, value: Any) -> str | None:
    if dim in NUMERIC_BUCKETS:
        if value is None:
            return None
        for lo, hi, label in NUMERIC_BUCKETS[dim]:
            if lo <= value < hi:
                return label
        return None
    if dim in BOOLEAN_FEATURES:
        return "Да" if (value or 0) >= FEATURE_THRESHOLD else "Нет"
    if dim == "location":
        return (value or "—").strip() or "—"
    return None


def _ordered_values(dim: str, observed: set[str]) -> list[str]:
    if dim in NUMERIC_BUCKETS:
        return [label for _, _, label in NUMERIC_BUCKETS[dim] if label in observed]
    if dim in BOOLEAN_FEATURES:
        return [v for v in ("Да", "Нет") if v in observed]
    if dim == "location":
        return sorted(observed)
    return sorted(observed)


def _extract(plot: dict, dim: str) -> Any:
    if dim in BOOLEAN_FEATURES:
        return (plot.get("features") or {}).get(dim, 0)
    return plot.get(dim)


class GetCustomStatsUseCase:
    def __init__(self, plot_repo: PlotRepositoryInterface):
        self._plot_repo = plot_repo

    async def execute(
        self,
        x: str,
        y: str,
        filters: dict[str, Any],
    ) -> dict:
        if x not in DIMENSIONS:
            raise ValueError(f"Unknown x dimension: {x}")
        if y not in DIMENSIONS:
            raise ValueError(f"Unknown y dimension: {y}")

        match: dict[str, Any] = {}
        if (v := filters.get("min_price")) is not None:
            match.setdefault("price", {})["$gte"] = float(v)
        if (v := filters.get("max_price")) is not None:
            match.setdefault("price", {})["$lte"] = float(v)
        if (v := filters.get("min_area")) is not None:
            match.setdefault("area_sotki", {})["$gte"] = float(v)
        if (v := filters.get("max_area")) is not None:
            match.setdefault("area_sotki", {})["$lte"] = float(v)
        if (v := filters.get("min_score")) is not None:
            match.setdefault("total_score", {})["$gte"] = float(v)
        if (v := filters.get("max_score")) is not None:
            match.setdefault("total_score", {})["$lte"] = float(v)
        if (v := filters.get("location")):
            match["location"] = {"$regex": str(v), "$options": "i"}

        for key in filters.get("require_features") or []:
            if key in BOOLEAN_FEATURES:
                match[f"features.{key}"] = {"$gte": FEATURE_THRESHOLD}

        projection_fields = {
            "price": 1, "area_sotki": 1, "price_per_sotka": 1,
            "total_score": 1, "infra_score": 1, "feature_score": 1,
            "location": 1, "features": 1,
        }

        pipeline: list[dict] = []
        if match:
            pipeline.append({"$match": match})
        pipeline.append({"$project": projection_fields})

        rows = await self._plot_repo.aggregate(pipeline)

        # Limit location to top values to keep chart readable
        if x == "location" or y == "location":
            counter = Counter((r.get("location") or "—").strip() or "—" for r in rows)
            top_locations = {name for name, _ in counter.most_common(12)}

        counts: dict[tuple[str, str], int] = {}
        x_values: set[str] = set()
        y_values: set[str] = set()

        for r in rows:
            xv = _extract(r, x)
            yv = _extract(r, y)
            xb = _bucket_for(x, xv)
            yb = _bucket_for(y, yv)
            if xb is None or yb is None:
                continue
            if x == "location" and xb not in top_locations:
                xb = "Прочее"
            if y == "location" and yb not in top_locations:
                yb = "Прочее"
            counts[(xb, yb)] = counts.get((xb, yb), 0) + 1
            x_values.add(xb)
            y_values.add(yb)

        x_axis = _ordered_values(x, x_values)
        y_axis = _ordered_values(y, y_values)
        if x == "location" and "Прочее" in x_values:
            x_axis = [v for v in x_axis if v != "Прочее"] + ["Прочее"]
        if y == "location" and "Прочее" in y_values:
            y_axis = [v for v in y_axis if v != "Прочее"] + ["Прочее"]

        cells = [
            {"x": xv, "y": yv, "count": counts.get((xv, yv), 0)}
            for xv in x_axis
            for yv in y_axis
        ]

        return {
            "x": x,
            "y": y,
            "x_label": DIMENSION_LABELS[x],
            "y_label": DIMENSION_LABELS[y],
            "x_values": x_axis,
            "y_values": y_axis,
            "cells": cells,
            "total": sum(counts.values()),
        }


def list_dimensions() -> list[dict]:
    return [{"key": k, "label": v} for k, v in DIMENSION_LABELS.items()]
