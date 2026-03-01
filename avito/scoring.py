"""
Итоговый числовой скоринг: взвешенная сумма всех факторов.
Использует pandas/numpy для нормализации.
"""

import numpy as np
import pandas as pd
from config import WEIGHTS


def normalize_series(s: pd.Series) -> pd.Series:
    """Min-max нормализация серии в диапазон [0, 1]."""
    mn, mx = s.min(), s.max()
    if mx - mn < 1e-9:
        return pd.Series(0.5, index=s.index)
    return (s - mn) / (mx - mn)


def compute_total_scores(records: list[dict]) -> list[dict]:
    """
    Рассчитывает total_score для каждой записи.

    Компоненты:
        - infra_score     (уже рассчитан geo_scoring)
        - negative_score  (уже рассчитан geo_scoring)
        - feature_score   (уже рассчитан feature_extractor)
        - price_score     (ниже цена за сотку → выше score)

    Все нормализуются в [0,1] по выборке, затем взвешенно суммируются.
    """
    df = pd.DataFrame(records)

    # Нормализуем infra и negative scores по выборке
    df["infra_norm"] = normalize_series(df["infra_score"])
    df["negative_norm"] = normalize_series(df["negative_score"])

    # Feature score: нормализуем
    df["feature_norm"] = normalize_series(df["feature_score"])

    # Price score: ниже цена за сотку → лучше
    # Заполняем пропуски медианой
    price_col = df["price_per_sotka"].fillna(df["price_per_sotka"].median())
    price_col = price_col.replace(0, df["price_per_sotka"].median())
    df["price_norm"] = 1.0 - normalize_series(price_col)

    # Взвешенная сумма
    df["total_score"] = (
        WEIGHTS["infra"]    * df["infra_norm"] +
        WEIGHTS["negative"] * df["negative_norm"] +
        WEIGHTS["features"] * df["feature_norm"] +
        WEIGHTS["price"]    * df["price_norm"]
    )
    df["total_score"] = df["total_score"].round(4)

    # Записываем обратно
    for i, rec in enumerate(records):
        rec["infra_norm"] = round(float(df.loc[i, "infra_norm"]), 4)
        rec["negative_norm"] = round(float(df.loc[i, "negative_norm"]), 4)
        rec["feature_norm"] = round(float(df.loc[i, "feature_norm"]), 4)
        rec["price_norm"] = round(float(df.loc[i, "price_norm"]), 4)
        rec["total_score"] = float(df.loc[i, "total_score"])

    return records
