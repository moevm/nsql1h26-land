import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, SlidersHorizontal, X } from 'lucide-react';
import { fetchPlots, type Plot, type PlotsListResponse, type PlotFilters } from '../api';

function formatPrice(p: number) {
  if (p >= 1_000_000) return (p / 1_000_000).toFixed(1).replace('.0', '') + ' млн ₽';
  if (p >= 1_000) return (p / 1_000).toFixed(0) + ' тыс ₽';
  return p.toLocaleString('ru-RU') + ' ₽';
}

function ScoreGauge({ value, size = 44 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value);
  const color =
    value >= 0.7 ? 'var(--c-green)' : value >= 0.4 ? 'var(--c-yellow)' : 'var(--c-red)';

  return (
    <svg width={size} height={size} className="gauge-ring">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--c-border)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fill: color,
          fontSize: size * 0.26,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}
      >
        {(value * 100).toFixed(0)}
      </text>
    </svg>
  );
}

function PlotCard({ plot, index }: { plot: Plot; index: number }) {
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
  const [formFilters, setFormFilters] = useState<{
    min_price: string; max_price: string;
    min_area: string; max_area: string;
    min_pps: string; max_pps: string;
    min_score: string; min_infra: string; min_feature: string;
    location: string;
  }>({
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
    setLoading(true);
    fetchPlots(currentPage, 20, sortField, sortOrder, filters)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentPage, sortField, sortOrder, filters]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    // Clear old filter params
    ['min_price', 'max_price', 'min_area', 'max_area', 'min_pps', 'max_pps', 'min_score', 'min_infra', 'min_feature', 'location'].forEach(k => params.delete(k));
    if (formFilters.min_price) params.set('min_price', formFilters.min_price);
    if (formFilters.max_price) params.set('max_price', formFilters.max_price);
    if (formFilters.min_area) params.set('min_area', formFilters.min_area);
    if (formFilters.max_area) params.set('max_area', formFilters.max_area);
    if (formFilters.min_pps) params.set('min_pps', formFilters.min_pps);
    if (formFilters.max_pps) params.set('max_pps', formFilters.max_pps);
    if (formFilters.min_score) params.set('min_score', formFilters.min_score);
    if (formFilters.min_infra) params.set('min_infra', formFilters.min_infra);
    if (formFilters.min_feature) params.set('min_feature', formFilters.min_feature);
    if (formFilters.location) params.set('location', formFilters.location);
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

  const inputStyle: React.CSSProperties = {
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    color: 'var(--c-text)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
  };

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

      {/* Filter Panel */}
      {showFilters && (
        <div
          className="rounded-xl p-5 mb-6 animate-fade-in"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--c-heading)', fontFamily: 'var(--font-display)' }}>
              Фильтры
            </h3>
            <button onClick={() => setShowFilters(false)} style={{ color: 'var(--c-text-dim)' }}>
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Price range */}
            <div>
              <label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                Цена, ₽
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="от"
                  value={formFilters.min_price}
                  onChange={(e) => setFormFilters({ ...formFilters, min_price: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="до"
                  value={formFilters.max_price}
                  onChange={(e) => setFormFilters({ ...formFilters, max_price: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Area range */}
            <div>
              <label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                Площадь, сот.
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="от"
                  value={formFilters.min_area}
                  onChange={(e) => setFormFilters({ ...formFilters, min_area: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="до"
                  value={formFilters.max_area}
                  onChange={(e) => setFormFilters({ ...formFilters, max_area: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Price per sotka */}
            <div>
              <label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                Цена за сотку, ₽
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="от"
                  value={formFilters.min_pps}
                  onChange={(e) => setFormFilters({ ...formFilters, min_pps: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="до"
                  value={formFilters.max_pps}
                  onChange={(e) => setFormFilters({ ...formFilters, max_pps: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Min total score */}
            <div>
              <label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                Мин. общий скор (0–1)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                placeholder="0.00"
                value={formFilters.min_score}
                onChange={(e) => setFormFilters({ ...formFilters, min_score: e.target.value })}
                className="w-full px-3 py-2 rounded-lg"
                style={inputStyle}
              />
            </div>

            {/* Min infra score */}
            <div>
              <label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                Мин. скор инфраструктуры (0–1)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                placeholder="0.00"
                value={formFilters.min_infra}
                onChange={(e) => setFormFilters({ ...formFilters, min_infra: e.target.value })}
                className="w-full px-3 py-2 rounded-lg"
                style={inputStyle}
              />
            </div>

            {/* Location */}
            <div>
              <label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                Район / Населённый пункт
              </label>
              <input
                type="text"
                placeholder="Пушкин, Гатчина..."
                value={formFilters.location}
                onChange={(e) => setFormFilters({ ...formFilters, location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg"
                style={{ ...inputStyle, fontFamily: 'var(--font-body)' }}
              />
            </div>
          </div>

          {/* Filter actions */}
          <div className="flex gap-3 mt-5">
            <button onClick={applyFilters} className="btn-primary text-sm">
              Применить
            </button>
            <button onClick={clearFilters} className="btn-ghost text-sm">
              Сбросить
            </button>
          </div>
        </div>
      )}

      {/* Active filter tags */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-2 mb-5">
          {filters.min_price !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-accent-dim)', color: 'var(--c-accent)' }}>
              Цена от {Number(filters.min_price).toLocaleString('ru-RU')} ₽
            </span>
          )}
          {filters.max_price !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-accent-dim)', color: 'var(--c-accent)' }}>
              Цена до {Number(filters.max_price).toLocaleString('ru-RU')} ₽
            </span>
          )}
          {filters.min_area !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-blue-dim)', color: 'var(--c-blue)' }}>
              от {filters.min_area} сот.
            </span>
          )}
          {filters.max_area !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-blue-dim)', color: 'var(--c-blue)' }}>
              до {filters.max_area} сот.
            </span>
          )}
          {filters.min_price_per_sotka !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-green-dim)', color: 'var(--c-green)' }}>
              ₽/сот. от {Number(filters.min_price_per_sotka).toLocaleString('ru-RU')}
            </span>
          )}
          {filters.max_price_per_sotka !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-green-dim)', color: 'var(--c-green)' }}>
              ₽/сот. до {Number(filters.max_price_per_sotka).toLocaleString('ru-RU')}
            </span>
          )}
          {filters.min_score !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-yellow-dim)', color: 'var(--c-yellow)' }}>
              Score ≥ {filters.min_score}
            </span>
          )}
          {filters.min_infra !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-blue-dim)', color: 'var(--c-blue)' }}>
              Инфра ≥ {filters.min_infra}
            </span>
          )}
          {filters.location && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-accent-dim)', color: 'var(--c-accent)' }}>
              {filters.location}
            </span>
          )}
          <button
            onClick={clearFilters}
            className="text-xs px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
            style={{ color: 'var(--c-red)', background: 'var(--c-red-dim)' }}
          >
            <X size={12} /> Сбросить
          </button>
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>
          Загрузка...
        </p>
      )}
      {error && (
        <p className="text-center py-16" style={{ color: 'var(--c-red)' }}>{error}</p>
      )}

      {data && data.items.length === 0 && (
        <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>
          Нет объявлений
        </p>
      )}

      {/* Grid */}
      {data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger-children">
            {data.items.map((p, i) => (
              <PlotCard key={p._id} plot={p} index={i} />
            ))}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-10">
              <button
                onClick={() => changePage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="btn-ghost text-sm disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => {
                let p: number;
                if (data.pages <= 7) {
                  p = i + 1;
                } else if (currentPage <= 4) {
                  p = i + 1;
                } else if (currentPage >= data.pages - 3) {
                  p = data.pages - 6 + i;
                } else {
                  p = currentPage - 3 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => changePage(p)}
                    className="w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{
                      background:
                        p === currentPage ? 'var(--c-accent)' : 'var(--c-surface)',
                      color: p === currentPage ? 'var(--c-bg)' : 'var(--c-text-muted)',
                      border: `1px solid ${p === currentPage ? 'var(--c-accent)' : 'var(--c-border)'}`,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => changePage(currentPage + 1)}
                disabled={currentPage >= data.pages}
                className="btn-ghost text-sm disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
