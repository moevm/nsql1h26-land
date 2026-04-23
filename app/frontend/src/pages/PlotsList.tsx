import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, SlidersHorizontal } from 'lucide-react';
import { type PlotFilters } from '../api';
import { getFiltersFromSearchParams, normalizeOrder, normalizeSort, parsePositiveInt } from '../lib/params';
import { getErrorMessage } from '../utils';
import { MemoPlotCard, ResultsLoadingScreen } from '../components/PlotCard';
import Pagination from '../components/Pagination';
import FilterPanel, { type FormState } from '../components/FilterPanel';
import { PageHeader } from '../components/PageHeader';
import { usePlotsListQuery, usePrefetchPlotDetail } from '../features/plots/hooks';
import { Button, Input } from '../components/ui';

const FILTER_PARAM_KEYS: Array<keyof FormState> = [
  'min_price',
  'max_price',
  'min_area',
  'max_area',
  'min_price_per_sotka',
  'max_price_per_sotka',
  'location',
];

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
    location: filters.location ?? '',
  };
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
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setSearchQuery(queryParam);
  }, [queryParam]);

  const applySearchQuery = useCallback((rawQuery: string) => {
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
    });
  }, [queryParam, setSearchParams]);

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
  const showResultsLoading = loading || (plotsQuery.isFetching && plotsQuery.isPlaceholderData);
  const error = plotsQuery.error ? getErrorMessage(plotsQuery.error) : '';
  const prefetchPlotDetail = usePrefetchPlotDetail();

  function handleSearch(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    applySearchQuery(searchQuery);
  }

  const applyFiltersFromForm = useCallback((form: FormState) => {
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
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
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
  }, [setSearchParams]);

  const closeFilters = useCallback(() => setShowFilters(false), []);

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
      <PageHeader
        title="Каталог участков"
        subtitle="Поиск и аналитика земельных участков Санкт-Петербурга и Ленинградской области"
        className="mb-8"
        titleClassName="text-3xl sm:text-4xl"
        subtitleStyle={{ fontFamily: 'var(--font-body)' }}
      />

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
        onClose={closeFilters}
      />

      {showResultsLoading && <ResultsLoadingScreen semanticMode={Boolean(queryParam)} />}
      {error && (
        <p className="text-center py-16" style={{ color: 'var(--c-red)' }} role="alert">{error}</p>
      )}

      {!showResultsLoading && data?.items.length === 0 && (
        <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>
          {queryParam ? 'Ничего не найдено по запросу' : 'Нет объявлений'}
        </p>
      )}

      {!showResultsLoading && data && data.items.length > 0 && (
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
