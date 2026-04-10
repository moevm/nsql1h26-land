import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, SlidersHorizontal, Heart, GitCompare } from 'lucide-react';
import { type Plot, type PlotFilters } from '../api';
import { formatPrice, getErrorMessage } from '../utils';
import ScoreGauge from '../components/ScoreGauge';
import Pagination from '../components/Pagination';
import FilterPanel, { type FormState } from '../components/FilterPanel';
import { PageHeader } from '../components/PageHeader';
import { usePlotsListQuery, usePrefetchPlotDetail, usePrefetchPlotsListPage } from '../features/plots/hooks';
import { useUserPrefsStore } from '../stores/userPrefsStore';
import { useDebounce } from '../hooks/useDebounce';
import { Button, Input } from '../components/ui';

function PlotCard({
  plot,
  index,
  semanticMode,
  onPrefetchDetail,
}: {
  readonly plot: Plot;
  readonly index: number;
  readonly semanticMode: boolean;
  readonly onPrefetchDetail?: (id: string) => Promise<unknown>;
}) {
  const isFavorite = useUserPrefsStore((state) => state.isFavorite(plot._id));
  const isCompared = useUserPrefsStore((state) => state.isCompared(plot._id));
  const toggleFavorite = useUserPrefsStore((state) => state.toggleFavorite);
  const toggleCompare = useUserPrefsStore((state) => state.toggleCompare);
  const prefetchDetail = () => {
    if (onPrefetchDetail) {
      void onPrefetchDetail(plot._id);
    }
  };

  return (
    <article
      className="card-hover rounded-xl overflow-hidden h-full flex flex-col"
      style={{
        background: 'var(--c-card)',
        border: '1px solid var(--c-border)',
        animationDelay: `${index * 60}ms`,
      }}
    >
      <Link
        to={`/plots/${plot._id}`}
        className="block flex-1 min-h-0"
        onMouseEnter={prefetchDetail}
        onFocus={prefetchDetail}
        onTouchStart={prefetchDetail}
      >
      {/* Image */}
      {plot.thumbnail ? (
        <div className="relative h-44 overflow-hidden">
          <img
            src={plot.thumbnail}
            alt={plot.title}
            className="w-full h-full object-cover motion-transform hover:scale-105"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, var(--c-card) 0%, transparent 50%)',
            }}
          />
          {/* Score badge overlay */}
          <div className="absolute top-3 right-3">
            <ScoreGauge value={plot.total_score} size={42} />
          </div>
        </div>
      ) : (
        <div
          className="h-44 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--c-surface), var(--c-card))',
          }}
        >
          <ScoreGauge value={plot.total_score} size={56} />
        </div>
      )}

      <div className="p-4 h-full flex flex-col">
        <h3
          className="font-semibold mb-1 line-clamp-2 text-sm leading-snug"
          style={{ color: 'var(--c-heading)', fontFamily: 'var(--font-body)', fontWeight: 600 }}
        >
          {plot.title}
        </h3>
        <p className="text-xs mb-3 truncate" style={{ color: 'var(--c-text-muted)' }}>
          {plot.location || plot.address}
        </p>

        <div
          className="mb-3 px-3 py-2.5 rounded-lg"
          style={{
            border: '1px solid var(--c-border)',
            background: 'color-mix(in srgb, var(--c-surface) 88%, transparent)',
          }}
        >
          <div className="flex items-end justify-between gap-2">
            <span
              className="text-lg font-bold"
              style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}
            >
              {formatPrice(plot.price)}
            </span>
            {plot.area_sotki && (
              <span
                className="text-xs whitespace-nowrap"
                style={{ color: 'var(--c-text-dim)' }}
              >
                {plot.area_sotki} сот.
              </span>
            )}
          </div>
          {plot.price_per_sotka && (
            <p className="mt-1 text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
              {formatPrice(plot.price_per_sotka)}/сот.
            </p>
          )}
        </div>

        {/* Micro-scores row */}
        <div className="flex flex-wrap gap-2 mt-auto">
          {[
            { v: plot.infra_score, l: 'И', c: 'var(--c-blue)' },
            { v: plot.negative_score, l: 'Э', c: 'var(--c-green)' },
            { v: plot.feature_score, l: 'Х', c: 'var(--c-accent)' },
          ].map((s) => (
            <span
              key={s.l}
              className="text-xs px-2 py-0.5 rounded-md"
              style={{
                background: `color-mix(in srgb, ${s.c} 12%, transparent)`,
                color: s.c,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
              }}
            >
              {s.l} {(s.v * 100).toFixed(0)}
            </span>
          ))}
          {semanticMode && plot.jina_score != null && (
            <span
              className="text-xs px-2 py-0.5 rounded-md"
              style={{
                background: 'var(--c-blue-dim)',
                color: 'var(--c-blue)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
              }}
            >
              J {(plot.jina_score * 100).toFixed(0)}
            </span>
          )}
          {semanticMode && plot.combined_score != null && (
            <span
              className="text-xs px-2 py-0.5 rounded-md"
              style={{
                background: 'var(--c-green-dim)',
                color: 'var(--c-green)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
              }}
            >
              C {(plot.combined_score * 100).toFixed(0)}
            </span>
          )}
        </div>
      </div>

      </Link>

      <div
        className="px-4 pb-4 pt-3 grid grid-cols-2 gap-2"
        style={{ borderTop: '1px solid var(--c-border)' }}
      >
        <Button
          onClick={() => toggleFavorite(plot._id)}
          variant="ghost"
          size="sm"
          className="w-full text-[11px] sm:text-xs px-2.5 py-1.5 rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap"
          style={{
            background: isFavorite ? 'var(--c-red-dim)' : 'var(--c-surface)',
            color: isFavorite ? 'var(--c-red)' : 'var(--c-text-muted)',
          }}
          aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
        >
          <Heart size={12} fill={isFavorite ? 'currentColor' : 'none'} />
          {isFavorite ? 'В избранном' : 'Избранное'}
        </Button>
        <Button
          onClick={() => toggleCompare(plot._id)}
          variant="ghost"
          size="sm"
          className="w-full text-[11px] sm:text-xs px-2.5 py-1.5 rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap"
          style={{
            background: isCompared ? 'var(--c-blue-dim)' : 'var(--c-surface)',
            color: isCompared ? 'var(--c-blue)' : 'var(--c-text-muted)',
          }}
          aria-label={isCompared ? 'Убрать из сравнения' : 'Добавить в сравнение'}
        >
          <GitCompare size={12} />
          {isCompared ? 'В сравнении' : 'Сравнение'}
        </Button>
      </div>
    </article>
  );
}

const MemoPlotCard = memo(PlotCard);

const FILTER_PARAM_KEYS: Array<keyof FormState> = [
  'min_price',
  'max_price',
  'min_area',
  'max_area',
  'min_price_per_sotka',
  'max_price_per_sotka',
  'min_score',
  'min_infra',
  'min_feature',
  'location',
];

const SORT_FIELDS = new Set([
  'relevance',
  'created_at',
  'price',
  'area_sotki',
  'price_per_sotka',
  'total_score',
  'infra_score',
  'feature_score',
]);

const ORDER_VALUES = new Set(['asc', 'desc']);

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseFilterNumber(searchParams: URLSearchParams, key: keyof PlotFilters): number | undefined {
  const raw = searchParams.get(key);
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function getFiltersFromSearchParams(searchParams: URLSearchParams): PlotFilters {
  const location = (searchParams.get('location') ?? '').trim();
  return {
    min_price: parseFilterNumber(searchParams, 'min_price'),
    max_price: parseFilterNumber(searchParams, 'max_price'),
    min_area: parseFilterNumber(searchParams, 'min_area'),
    max_area: parseFilterNumber(searchParams, 'max_area'),
    min_price_per_sotka: parseFilterNumber(searchParams, 'min_price_per_sotka'),
    max_price_per_sotka: parseFilterNumber(searchParams, 'max_price_per_sotka'),
    min_score: parseFilterNumber(searchParams, 'min_score'),
    min_infra: parseFilterNumber(searchParams, 'min_infra'),
    min_feature: parseFilterNumber(searchParams, 'min_feature'),
    location: location || undefined,
  };
}

function toFormState(filters: PlotFilters): FormState {
  const toText = (value: number | undefined): string => (
    typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
  );

  return {
    min_price: toText(filters.min_price),
    max_price: toText(filters.max_price),
    min_area: toText(filters.min_area),
    max_area: toText(filters.max_area),
    min_price_per_sotka: toText(filters.min_price_per_sotka),
    max_price_per_sotka: toText(filters.max_price_per_sotka),
    min_score: toText(filters.min_score),
    min_infra: toText(filters.min_infra),
    min_feature: toText(filters.min_feature),
    location: filters.location ?? '',
  };
}

function normalizeSort(sortParam: string | null, query: string): string {
  const hasQuery = query.length > 0;
  const fallback = hasQuery ? 'relevance' : 'created_at';
  if (!sortParam || !SORT_FIELDS.has(sortParam)) return fallback;
  if (sortParam === 'relevance' && !hasQuery) return 'created_at';
  return sortParam;
}

function normalizeOrder(orderParam: string | null): 'asc' | 'desc' {
  return ORDER_VALUES.has(orderParam ?? '') ? (orderParam as 'asc' | 'desc') : 'desc';
}

export default function PlotsList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const queryParam = (searchParams.get('q') ?? '').trim();
  const currentPage = parsePositiveInt(searchParams.get('page'), 1);
  const sortField = normalizeSort(searchParams.get('sort'), queryParam);
  const sortOrder = normalizeOrder(searchParams.get('order'));

  const filters = useMemo(
    () => getFiltersFromSearchParams(searchParams),
    [searchParams],
  );
  const formFilters = useMemo(() => toFormState(filters), [filters]);
  const activeFilterCount = Object.values(filters).filter((value) => value !== undefined && value !== '').length;

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const debouncedSearchQuery = useDebounce(searchQuery, 350);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setSearchQuery(queryParam);
  }, [queryParam]);

  const applySearchQuery = useCallback((rawQuery: string, replace = false) => {
    const nextQuery = rawQuery.trim();
    if (nextQuery === queryParam) return;

    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('page', '1');

      if (nextQuery) {
        params.set('q', nextQuery);
      } else {
        params.delete('q');
        if (params.get('sort') === 'relevance') {
          params.delete('sort');
          params.delete('order');
        }
      }

      return params;
    }, { replace });
  }, [queryParam, setSearchParams]);

  useEffect(() => {
    applySearchQuery(debouncedSearchQuery, true);
  }, [debouncedSearchQuery, applySearchQuery]);

  const plotsQuery = usePlotsListQuery({
    page: currentPage,
    pageSize: 20,
    sort: sortField,
    order: sortOrder,
    query: queryParam,
    filters,
  });

  const data = plotsQuery.data ?? null;
  const loading = plotsQuery.isLoading;
  const error = plotsQuery.error ? getErrorMessage(plotsQuery.error) : '';
  const prefetchPlotDetail = usePrefetchPlotDetail();
  const prefetchPlotsPage = usePrefetchPlotsListPage({
    pageSize: 20,
    sort: sortField,
    order: sortOrder,
    query: queryParam,
    filters,
  });

  function handleSearch(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    applySearchQuery(searchQuery);
  }

  function applyFiltersFromForm(form: FormState) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('page', '1');
      FILTER_PARAM_KEYS.forEach((key) => params.delete(key));

      const setIfNotEmpty = (key: keyof FormState) => {
        const value = form[key].trim();
        if (value) {
          params.set(key, value);
        }
      };

      FILTER_PARAM_KEYS.forEach((key) => setIfNotEmpty(key));
      return params;
    });
    setShowFilters(false);
  }

  function clearFilters() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      FILTER_PARAM_KEYS.forEach((key) => params.delete(key));
      params.set('page', '1');

      const q = (params.get('q') ?? '').trim();
      if (!q && params.get('sort') === 'relevance') {
        params.delete('sort');
        params.delete('order');
      }

      return params;
    });
    setShowFilters(false);
  }

  const changePage = useCallback((nextPage: number, replace = false) => {
    const boundedLow = Math.max(1, Math.floor(nextPage));
    const bounded = data ? Math.min(boundedLow, Math.max(1, data.pages)) : boundedLow;

    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('page', String(bounded));
      return params;
    }, { replace });
  }, [data, setSearchParams]);

  useEffect(() => {
    if (!data) return;
    if (currentPage > data.pages) {
      changePage(data.pages, true);
    }
  }, [currentPage, data, changePage]);

  useEffect(() => {
    if (!data || currentPage >= data.pages) {
      return;
    }

    void prefetchPlotsPage(currentPage + 1);
  }, [currentPage, data, prefetchPlotsPage]);

  function changeSort(field: string) {
    if (field === 'relevance' && !queryParam) return;

    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (sortField === field) {
        params.set('order', sortOrder === 'desc' ? 'asc' : 'desc');
      } else {
        params.set('sort', field);
        params.set('order', 'desc');
      }
      params.set('page', '1');
      return params;
    });
  }

  return (
    <div className="animate-fade-in">
      {/* Hero section */}
      <PageHeader
        title="Каталог участков"
        subtitle="Поиск и аналитика земельных участков Санкт-Петербурга и Ленинградской области"
        className="mb-8"
        titleClassName="text-3xl sm:text-4xl"
        subtitleStyle={{ fontFamily: 'var(--font-body)' }}
      />

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск: тихий участок у воды, ИЖС с коммуникациями..."
              aria-label="Поисковый запрос"
            />
          </div>
          <Button type="submit" className="whitespace-nowrap">
            Найти
          </Button>
        </div>
      </form>

      {queryParam && (
        <div className="mb-4 flex items-center gap-3 text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
          <span>Семантический запрос: «{queryParam}»</span>
            <Button
            onClick={() => {
              applySearchQuery('');
            }}
              variant="ghost"
              size="sm"
              className="px-2 py-1 rounded-md"
            style={{ background: 'var(--c-surface)', color: 'var(--c-text-muted)', border: '1px solid var(--c-border)' }}
          >
            Очистить запрос
            </Button>
        </div>
      )}

      {/* Sort + Filter controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs uppercase tracking-wider mr-2" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
          Сортировка
        </span>
        {[
          ...(queryParam ? [{ field: 'relevance', label: 'Релев.' }] : []),
          { field: 'created_at', label: 'Дата' },
          { field: 'price', label: 'Цена' },
          { field: 'area_sotki', label: 'Площадь' },
          { field: 'price_per_sotka', label: '₽/сот.' },
          { field: 'total_score', label: 'Score' },
          { field: 'infra_score', label: 'Инфра' },
          { field: 'feature_score', label: 'Хар-ки' },
        ].map((s) => {
          const active = sortField === s.field;
          return (
            <Button
              key={s.field}
              onClick={() => changeSort(s.field)}
              variant="ghost"
              size="sm"
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                background: active ? 'var(--c-accent-dim)' : 'var(--c-surface)',
                color: active ? 'var(--c-accent)' : 'var(--c-text-muted)',
                border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {s.label} {active && (sortOrder === 'desc' ? <ArrowDown size={12} className="inline-block ml-0.5" /> : <ArrowUp size={12} className="inline-block ml-0.5" />)}
            </Button>
          );
        })}

        <div className="ml-auto flex items-center gap-3">
          {plotsQuery.isFetching && data && (
            <span className="text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
              Обновление...
            </span>
          )}
          {data && (
            <span className="text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }} aria-live="polite">
              {data.total} объявлений
            </span>
          )}
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: activeFilterCount > 0 ? 'var(--c-accent-dim)' : 'var(--c-surface)',
              color: activeFilterCount > 0 ? 'var(--c-accent)' : 'var(--c-text-muted)',
              border: `1px solid ${activeFilterCount > 0 ? 'var(--c-accent)' : 'var(--c-border)'}`,
              fontFamily: 'var(--font-mono)',
            }}
            aria-expanded={showFilters}
            aria-controls="plots-filter-panel"
          >
            <SlidersHorizontal size={13} />
            Фильтры
            {activeFilterCount > 0 && (
              <span
                className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--c-accent)', color: 'var(--c-bg)', fontSize: '0.6rem' }}
              >
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      <FilterPanel
        visible={showFilters}
        filters={filters}
        initialForm={formFilters}
        onApply={applyFiltersFromForm}
        onClear={clearFilters}
        onClose={() => setShowFilters(false)}
      />

      {/* Loading / Error */}
      {loading && (
        <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }} role="status" aria-live="polite">
          Загрузка...
        </p>
      )}
      {error && (
        <p className="text-center py-16" style={{ color: 'var(--c-red)' }} role="alert">{error}</p>
      )}

      {data?.items.length === 0 && (
        <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>
          {queryParam ? 'Ничего не найдено по запросу' : 'Нет объявлений'}
        </p>
      )}

      {/* Grid */}
      {data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger-children">
            {data.items.map((p, i) => (
              <MemoPlotCard
                key={p._id}
                plot={p}
                index={i}
                semanticMode={Boolean(queryParam)}
                onPrefetchDetail={prefetchPlotDetail}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={data.pages}
              onPageChange={changePage}
            />
          )}
        </>
      )}
    </div>
  );
}
