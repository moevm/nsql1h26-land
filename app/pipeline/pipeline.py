"""
Главный пайплайн аналитики земельных участков.

Этапы:
  1. Загрузка и нормализация данных из JSON
  2. Извлечение текстовых фич (sentence-transformers, локально)
  3. Расчёт географических расстояний (geopy)
  4. Числовой скоринг (pandas/numpy) → total_score
  5. Фильтрация по жёстким критериям
  6. BM25 pre-ranking (по текстовому запросу)
  7. Комбинированный скор: combined = α·quality + β·bm25_relevance
  8. Jina Reranker (семантический реранкинг по combined-топу)

Использование:
  python pipeline.py
  python pipeline.py --query "тихий участок с домом рядом с метро"
  python pipeline.py --query "лес, ИЖС" --top 10 --min-price 500000 --max-price 3000000
"""

import argparse
import json
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_loader import load_and_normalize
from feature_extractor import enrich_with_features
from geo_scoring import enrich_with_geo
from scoring import compute_total_scores
from bm25_ranker import bm25_prerank
from jina_reranker import jina_rerank
from config import (
    DATA_PATH,
    CACHE_PATH,
    BM25_TOP_K_MULTIPLIER,
    JINA_TOP_K_MULTIPLIER,
    DEFAULT_TOP_N,
    ALPHA,
    BETA,
)


def _stage_timer(name: str):
    """Контекстный менеджер для замера времени этапа."""
    class _Timer:
        def __init__(self):
            self.elapsed = 0.0
        def __enter__(self):
            self._start = time.time()
            return self
        def __exit__(self, *args):
            self.elapsed = time.time() - self._start
    return _Timer()


def _load_cache(cache_path: str) -> list[dict] | None:
    """Загружает закэшированные обогащённые данные из JSON."""
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Проверяем новый формат: вложенный dict features + embedding
            if (data
                    and isinstance(data[0].get("features"), dict)
                    and isinstance(data[0].get("embedding"), list)
                    and len(data[0]["embedding"]) > 0
                    and "infra_score" in data[0]
                    and "feature_score" in data[0]):
                return data
        except (json.JSONDecodeError, KeyError, IndexError):
            pass
    return None


def _save_cache(records: list[dict], cache_path: str):
    """Сохраняет обогащённые данные в JSON-кэш."""
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"       Кэш сохранён: {cache_path}")


def filter_records(
    records: list[dict],
    min_price: float = None,
    max_price: float = None,
    min_area: float = None,
    max_area: float = None,
    location: str = None,
) -> list[dict]:
    """Этап 1: жёсткие фильтры (цена, площадь, район)."""
    filtered = records
    if min_price is not None:
        filtered = [r for r in filtered if r.get("price", 0) >= min_price]
    if max_price is not None:
        filtered = [r for r in filtered if r.get("price", 0) <= max_price]
    if min_area is not None:
        filtered = [r for r in filtered if (r.get("area_sotki") or 0) >= min_area]
    if max_area is not None:
        filtered = [r for r in filtered if (r.get("area_sotki") or 0) <= max_area]
    if location:
        loc_lower = location.lower()
        filtered = [
            r for r in filtered
            if loc_lower in r.get("location", "").lower()
            or loc_lower in r.get("address", "").lower()
        ]
    return filtered


def print_results(results: list[dict], show_details: bool = False):
    """Красивый вывод результатов."""
    try:
        from tabulate import tabulate
        has_tabulate = True
    except ImportError:
        has_tabulate = False

    if not results:
        print("\n  Нет результатов по заданным фильтрам.\n")
        return

    print(f"\n{'='*120}")
    print(f"  РЕЗУЛЬТАТЫ РАНЖИРОВАНИЯ: ТОП-{len(results)} участков")
    print(f"{'='*120}\n")

    if has_tabulate:
        table = []
        for i, r in enumerate(results, 1):
            row = [
                i,
                r.get("avito_id", "?"),
                r.get("title", "")[:40],
                r.get("location", "")[:20],
                f"{r.get('price', 0):,.0f} ₽",
                f"{r.get('area_sotki', '?')}",
                f"{r.get('price_per_sotka', 0):,.0f}" if r.get("price_per_sotka") else "?",
                f"{r.get('combined_score', r.get('total_score', 0)):.4f}",
                f"{r.get('total_score', 0):.4f}",
                f"{r.get('bm25_score', 0):.2f}" if r.get("bm25_score") else "-",
                f"{r.get('jina_score', 0):.4f}" if r.get("jina_score") is not None else "-",
            ]
            table.append(row)

        headers = ["#", "ID", "Название", "Район", "Цена", "Сотки", "₽/сотка", "Combined", "Quality", "BM25", "Jina"]
        print(tabulate(table, headers=headers, tablefmt="simple_outline"))
    else:
        for i, r in enumerate(results, 1):
            print(f"  {i:>2}. {r.get('title', '')[:50]}")
            print(f"      Район: {r.get('location', '')} | Цена: {r.get('price', 0):,.0f} ₽ | Сотки: {r.get('area_sotki', '?')}")
            print(f"      Final: {r.get('combined_score', r.get('total_score', 0)):.4f} | Quality: {r.get('total_score', 0):.4f} | BM25: {r.get('bm25_score', '-')} | Jina: {r.get('jina_score', '-')}")
            print()

    if show_details and results:
        print(f"\n{'─'*120}")
        print("  ДЕТАЛИЗАЦИЯ СКОРОВ (топ-5):")
        print(f"{'─'*120}\n")
        for i, r in enumerate(results[:5], 1):
            avito_id = r.get('avito_id', '?')
            print(f"  {i}. {r.get('title', '')} [ID: {avito_id}] — {r.get('location', '')}")
            print(f"     Цена: {r.get('price', 0):,.0f} ₽ ({r.get('price_per_sotka', 0):,.0f} ₽/сотка)")
            print(f"     Метро: {r.get('nearest_metro_name', '?')} ({r.get('nearest_metro_km', '?')} км)")
            print(f"     Больница: {r.get('nearest_hospital_name', '?')} ({r.get('nearest_hospital_km', '?')} км)")
            print(f"     Школа: {r.get('nearest_school_name', '?')} ({r.get('nearest_school_km', '?')} км)")
            print(f"     Негатив: {r.get('nearest_negative_name', '?')} ({r.get('nearest_negative_km', '?')} км)")
            print(f"     Фичи: {r.get('features_text', '-')}")
            print(f"     Скоры: infra={r.get('infra_norm', 0):.3f} negative={r.get('negative_norm', 0):.3f} "
                  f"features={r.get('feature_norm', 0):.3f} price={r.get('price_norm', 0):.3f}")
            print(f"     URL: {r.get('url', '')}")
            print()


def run_pipeline(
    data_path: str = DATA_PATH,
    query: str = "",
    top_n: int = DEFAULT_TOP_N,
    min_price: float = None,
    max_price: float = None,
    min_area: float = None,
    max_area: float = None,
    location: str = None,
    skip_jina: bool = False,
    no_cache: bool = False,
    cache_path: str = CACHE_PATH,
):
    """Запускает полный пайплайн аналитики."""

    t0 = time.time()
    timings: list[tuple[str, float]] = []

    cached = None if no_cache else _load_cache(cache_path)

    if cached is not None:
        with _stage_timer("cache") as t:
            records = cached
        print(f"[1/7] Загрузка из кэша ({len(records)} записей)... ✓ {t.elapsed:.2f}s")
        timings.append(("Загрузка (кэш)", t.elapsed))

        with _stage_timer("scoring") as t:
            records = compute_total_scores(records)
            scores = [r["total_score"] for r in records]
        print(f"[2/7] Числовой скоринг (pandas/numpy)... ✓ {t.elapsed:.2f}s")
        print(f"       Score: min={min(scores):.4f}, max={max(scores):.4f}, "
              f"mean={sum(scores)/len(scores):.4f}")
        timings.append(("Скоринг", t.elapsed))

    else:
        with _stage_timer("load") as t:
            records = load_and_normalize(data_path)
        print(f"[1/7] Загрузка данных ({len(records)} записей)... ✓ {t.elapsed:.2f}s")
        timings.append(("Загрузка", t.elapsed))

        with _stage_timer("features") as t:
            records = enrich_with_features(records)
        from config import FEATURE_DEFINITIONS, FEATURE_THRESHOLD
        feat_names = list(FEATURE_DEFINITIONS.keys())
        feat_avg = {}
        for fn in feat_names:
            vals = [r.get(fn, 0) for r in records if isinstance(r.get(fn), (int, float))]
            if vals:
                above = sum(1 for v in vals if v >= FEATURE_THRESHOLD)
                feat_avg[fn] = above
        top_feats = sorted(feat_avg.items(), key=lambda x: -x[1])[:5]
        print(f"[2/7] Извлечение фич (Embeddings, local)... ✓ {t.elapsed:.2f}s")
        print(f"       Топ фичи (>={FEATURE_THRESHOLD:.0%}): {', '.join(f'{k}={v}' for k, v in top_feats)}")
        timings.append(("Фичи (Embeddings)", t.elapsed))

        with _stage_timer("geo") as t:
            records = enrich_with_geo(records)
        print(f"[3/7] Расчёт расстояний (geopy)... ✓ {t.elapsed:.2f}s")
        timings.append(("Гео-расстояния", t.elapsed))

        with _stage_timer("scoring") as t:
            records = compute_total_scores(records)
            scores = [r["total_score"] for r in records]
        print(f"[4/7] Числовой скоринг (pandas/numpy)... ✓ {t.elapsed:.2f}s")
        print(f"       Score: min={min(scores):.4f}, max={max(scores):.4f}, "
              f"mean={sum(scores)/len(scores):.4f}")
        timings.append(("Скоринг", t.elapsed))

        _save_cache(records, cache_path)

    with _stage_timer("filter") as t:
        filtered = filter_records(
            records,
            min_price=min_price,
            max_price=max_price,
            min_area=min_area,
            max_area=max_area,
            location=location,
        )
    print(f"[5/7] Фильтрация ({len(filtered)} записей)... ✓ {t.elapsed:.2f}s")
    timings.append(("Фильтрация", t.elapsed))

    if not filtered:
        print("\n  Нет записей после фильтрации.")
        return []

    filtered.sort(key=lambda x: x.get("total_score", 0), reverse=True)

    bm25_top_k = top_n * BM25_TOP_K_MULTIPLIER
    with _stage_timer("bm25") as t:
        if query:
            bm25_results = bm25_prerank(query, filtered, top_k=bm25_top_k)
        else:
            bm25_results = filtered[:bm25_top_k]
    if query:
        print(f"[6/8] BM25 pre-ranking ({len(bm25_results)} кандидатов)... ✓ {t.elapsed:.2f}s")
    else:
        print(f"[6/8] BM25 пропущен (нет запроса), top-{bm25_top_k} по score... ✓ {t.elapsed:.2f}s")
    timings.append(("BM25", t.elapsed))

    with _stage_timer("combine") as t:
        if query:
            ts_vals = [r.get("total_score", 0) for r in bm25_results]
            ts_min, ts_max = min(ts_vals), max(ts_vals)
            ts_range = ts_max - ts_min if ts_max - ts_min > 1e-9 else 1.0

            bm_vals = [r.get("bm25_score", 0) or 0 for r in bm25_results]
            bm_min, bm_max = min(bm_vals), max(bm_vals)
            bm_range = bm_max - bm_min if bm_max - bm_min > 1e-9 else 1.0

            for r in bm25_results:
                ts_norm = (r.get("total_score", 0) - ts_min) / ts_range
                bm_norm = ((r.get("bm25_score", 0) or 0) - bm_min) / bm_range
                r["combined_score"] = round(ALPHA * ts_norm + BETA * bm_norm, 4)

            bm25_results.sort(key=lambda x: x.get("combined_score", 0), reverse=True)
            cs_vals = [r["combined_score"] for r in bm25_results]
            print(f"[7/8] Комбинированный скор (α={ALPHA}, β={BETA})... ✓ {t.elapsed:.2f}s")
            print(f"       Combined: min={min(cs_vals):.4f}, max={max(cs_vals):.4f}, "
                  f"mean={sum(cs_vals)/len(cs_vals):.4f}")
        else:
            for r in bm25_results:
                r["combined_score"] = r.get("total_score", 0)
            print(f"[7/8] Combined = total_score (нет запроса)... ✓ {t.elapsed:.2f}s")
    timings.append(("Комбинированный", t.elapsed))

    jina_input_k = top_n * JINA_TOP_K_MULTIPLIER
    combined_top = bm25_results[:jina_input_k]
    with _stage_timer("jina") as t:
        if not skip_jina and query:
            final = jina_rerank(query, combined_top, top_n=top_n)
        else:
            final = combined_top[:top_n]
    if not skip_jina and query:
        print(f"[8/8] Jina Reranker ({len(final)} результатов)... ✓ {t.elapsed:.2f}s")
    elif skip_jina:
        print(f"[8/8] Jina пропущен (--skip-jina), финал по combined... ✓ {t.elapsed:.2f}s")
    else:
        print(f"[8/8] Jina пропущен (нет запроса)... ✓ {t.elapsed:.2f}s")
    timings.append(("Jina Reranker", t.elapsed))

    elapsed = time.time() - t0
    print(f"\n  {'─'*50}")
    print(f"  ВРЕМЯ ВЫПОЛНЕНИЯ:")
    for stage_name, stage_time in timings:
        bar = '█' * int(stage_time / elapsed * 30) if elapsed > 0 else ''
        print(f"    {stage_name:<20} {stage_time:>6.2f}s  {bar}")
    print(f"    {'ИТОГО':<20} {elapsed:>6.2f}s")
    print(f"  {'─'*50}")

    print_results(final, show_details=True)

    return final


def main():
    parser = argparse.ArgumentParser(
        description="Аналитика земельных участков Авито — ранжирование по привлекательности"
    )
    parser.add_argument(
        "--data", type=str, default=DATA_PATH,
        help="Путь к JSON-файлу с данными"
    )
    parser.add_argument(
        "--query", "-q", type=str, default="",
        help="Текстовый запрос (для BM25 + Jina). Пример: 'тихий участок рядом с метро с домом'"
    )
    parser.add_argument(
        "--top", "-n", type=int, default=DEFAULT_TOP_N,
        help=f"Количество результатов (по умолчанию {DEFAULT_TOP_N})"
    )
    parser.add_argument("--min-price", type=float, default=None, help="Мин. цена")
    parser.add_argument("--max-price", type=float, default=None, help="Макс. цена")
    parser.add_argument("--min-area", type=float, default=None, help="Мин. площадь (сотки)")
    parser.add_argument("--max-area", type=float, default=None, help="Макс. площадь (сотки)")
    parser.add_argument("--location", type=str, default=None, help="Район/город")
    parser.add_argument("--skip-jina", action="store_true", help="Пропустить Jina Reranker")
    parser.add_argument("--no-cache", action="store_true", help="Не использовать кэш, пересчитать всё")

    args = parser.parse_args()

    run_pipeline(
        data_path=args.data,
        query=args.query,
        top_n=args.top,
        min_price=args.min_price,
        max_price=args.max_price,
        min_area=args.min_area,
        max_area=args.max_area,
        location=args.location,
        skip_jina=args.skip_jina,
        no_cache=args.no_cache,
    )


if __name__ == "__main__":
    main()
