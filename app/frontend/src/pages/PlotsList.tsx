import { useState, useEffect, useCallback, memo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ArrowDown, ArrowUp, SlidersHorizontal } from 'lucide-react';
import { fetchPlots, type Plot, type PlotsListResponse, type PlotFilters } from '../api';
import { formatPrice, getErrorMessage } from '../utils';
import ScoreGauge from '../components/ScoreGauge';
import Pagination from '../components/Pagination';
import FilterPanel, { type FormState } from '../components/FilterPanel';

function PlotCard({ plot, index }: { readonly plot: Plot; readonly index: number }) {
  return (
    <Link
      to={`/plots/${plot._id}`}
      className="card-hover block rounded-xl overflow-hidden"
      style={{
        background: 'var(--c-card)',
        border: '1px solid var(--c-border)',
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Image */}
      {plot.thumbnail ? (
        <div className="relative h-44 overflow-hidden">
          <img
            src={plot.thumbnail}
            alt={plot.title}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
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

      <div className="p-4">
        <h3
          className="font-semibold mb-1 line-clamp-2 text-sm leading-snug"
          style={{ color: 'var(--c-heading)', fontFamily: 'var(--font-body)', fontWeight: 600 }}
        >
          {plot.title}
        </h3>
        <p className="text-xs mb-3 truncate" style={{ color: 'var(--c-text-muted)' }}>
          {plot.location || plot.address}
        </p>

        <div className="flex items-end justify-between">
          <div>
            <span
              className="text-lg font-bold"
              style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}
            >
              {formatPrice(plot.price)}
            </span>
            {plot.area_sotki && (
              <span
                className="ml-2 text-xs"
                style={{ color: 'var(--c-text-dim)' }}
              >
                {plot.area_sotki} сот.
              </span>
            )}
          </div>
        </div>

        {/* Micro-scores row */}
        <div className="flex gap-2 mt-3">
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
        </div>
      </div>
    </Link>
  );
}

const MemoPlotCard = memo(PlotCard);

export default function PlotsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = Number(searchParams.get('page') || '1');
  const sortField = searchParams.get('sort') || 'created_at';
  const sortOrder = searchParams.get('order') || 'desc';

  const [data, setData] = useState<PlotsListResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter state from URL params
  const getFilterFromParams = useCallback((): PlotFilters => {
    const f: PlotFilters = {};
    const num = (k: string) => { const v = searchParams.get(k); return v ? Number(v) : undefined; };
    f.min_price = num('min_price');
    f.max_price = num('max_price');
    f.min_area = num('min_area');
    f.max_area = num('max_area');
    f.min_price_per_sotka = num('min_pps');
    f.max_price_per_sotka = num('max_pps');
    f.min_score = num('min_score');
    f.min_infra = num('min_infra');
    f.min_feature = num('min_feature');
    f.location = searchParams.get('location') || undefined;
    return f;
  }, [searchParams]);

  const [filters, setFilters] = useState<PlotFilters>(getFilterFromParams);

  // Local form state for editing
  const [formFilters, setFormFilters] = useState<FormState>({
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    min_area: searchParams.get('min_area') || '',
    max_area: searchParams.get('max_area') || '',
    min_pps: searchParams.get('min_pps') || '',
    max_pps: searchParams.get('max_pps') || '',
    min_score: searchParams.get('min_score') || '',
    min_infra: searchParams.get('min_infra') || '',
    min_feature: searchParams.get('min_feature') || '',
    location: searchParams.get('location') || '',
  });

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  useEffect(() => {
    setFilters(getFilterFromParams());
  }, [getFilterFromParams]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchPlots(currentPage, 20, sortField, sortOrder, filters, controller.signal)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentPage, sortField, sortOrder, filters]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  function applyFiltersFromForm(form: FormState) {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    // Clear old filter params
    ['min_price', 'max_price', 'min_area', 'max_area', 'min_pps', 'max_pps', 'min_score', 'min_infra', 'min_feature', 'location'].forEach(k => params.delete(k));
    if (form.min_price) params.set('min_price', form.min_price);
    if (form.max_price) params.set('max_price', form.max_price);
    if (form.min_area) params.set('min_area', form.min_area);
    if (form.max_area) params.set('max_area', form.max_area);
    if (form.min_pps) params.set('min_pps', form.min_pps);
    if (form.max_pps) params.set('max_pps', form.max_pps);
    if (form.min_score) params.set('min_score', form.min_score);
    if (form.min_infra) params.set('min_infra', form.min_infra);
    if (form.min_feature) params.set('min_feature', form.min_feature);
    if (form.location) params.set('location', form.location);
    setSearchParams(params);
    setShowFilters(false);
  }

  function clearFilters() {
    const params = new URLSearchParams();
    if (searchParams.get('sort')) params.set('sort', searchParams.get('sort')!);
    if (searchParams.get('order')) params.set('order', searchParams.get('order')!);
    setSearchParams(params);
    setFormFilters({ min_price: '', max_price: '', min_area: '', max_area: '', min_pps: '', max_pps: '', min_score: '', min_infra: '', min_feature: '', location: '' });
    setShowFilters(false);
  }

  function changePage(p: number) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  }

  function changeSort(field: string) {
    const params = new URLSearchParams(searchParams);
    if (sortField === field) {
      params.set('order', sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      params.set('sort', field);
      params.set('order', 'desc');
    }
    params.set('page', '1');
    setSearchParams(params);
  }

  return (
    <div className="animate-fade-in">
      {/* Hero section */}
      <div className="mb-8">
        <h1
          className="text-3xl sm:text-4xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
        >
          Каталог участков
        </h1>
        <p style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-body)' }}>
          Поиск и аналитика земельных участков Санкт-Петербурга и Ленинградской области
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--c-text-dim)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск: тихий участок у воды, ИЖС с коммуникациями..."
              className="input-field pl-10"
            />
          </div>
          <button type="submit" className="btn-primary whitespace-nowrap">
            Найти
          </button>
        </div>
      </form>

      {/* Sort + Filter controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs uppercase tracking-wider mr-2" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
          Сортировка
        </span>
        {[
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
            <button
              key={s.field}
              onClick={() => changeSort(s.field)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                background: active ? 'var(--c-accent-dim)' : 'var(--c-surface)',
                color: active ? 'var(--c-accent)' : 'var(--c-text-muted)',
                border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {s.label} {active && (sortOrder === 'desc' ? <ArrowDown size={12} className="inline-block ml-0.5" /> : <ArrowUp size={12} className="inline-block ml-0.5" />)}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-3">
          {data && (
            <span className="text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
              {data.total} объявлений
            </span>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
            style={{
              background: activeFilterCount > 0 ? 'var(--c-accent-dim)' : 'var(--c-surface)',
              color: activeFilterCount > 0 ? 'var(--c-accent)' : 'var(--c-text-muted)',
              border: `1px solid ${activeFilterCount > 0 ? 'var(--c-accent)' : 'var(--c-border)'}`,
              fontFamily: 'var(--font-mono)',
            }}
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
          </button>
        </div>
      </div>

      <FilterPanel
        visible={showFilters}
        filters={filters}
        initialForm={formFilters}
        onApply={(form) => { setFormFilters(form); applyFiltersFromForm(form); }}
        onClear={clearFilters}
        onClose={() => setShowFilters(false)}
      />

      {/* Loading / Error */}
      {loading && (
        <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>
          Загрузка...
        </p>
      )}
      {error && (
        <p className="text-center py-16" style={{ color: 'var(--c-red)' }}>{error}</p>
      )}

      {data?.items.length === 0 && (
        <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>
          Нет объявлений
        </p>
      )}

      {/* Grid */}
      {data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger-children">
            {data.items.map((p, i) => (
              <MemoPlotCard key={p._id} plot={p} index={i} />
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
