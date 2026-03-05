import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { searchPlots, type Plot, type SearchResponse } from '../api';

function formatPrice(p: number) {
  if (p >= 1_000_000) return (p / 1_000_000).toFixed(1).replace('.0', '') + ' млн ₽';
  if (p >= 1_000) return (p / 1_000).toFixed(0) + ' тыс ₽';
  return p.toLocaleString('ru-RU') + ' ₽';
}

function MiniGauge({ value, color, size = 32 }: { value: number; color: string; size?: number }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--c-border)" strokeWidth="2.5" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ fill: color, fontSize: size * 0.3, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
        {(value * 100).toFixed(0)}
      </text>
    </svg>
  );
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const currentPage = Number(searchParams.get('page') || '1');

  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError('');
    searchPlots(query, currentPage, 20)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query, currentPage]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchParams({ q: searchInput.trim() });
    }
  }

  function changePage(p: number) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  }

  const results = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 0;
  const canExpand = data?.can_expand ?? false;

  return (
    <div className="animate-fade-in">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-dim)' }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск: тихий участок у воды, ИЖС с коммуникациями..."
              className="input-field pl-10"
            />
          </div>
          <button type="submit" className="btn-primary whitespace-nowrap">Найти</button>
        </div>
      </form>

      {query && (
        <div className="flex items-baseline gap-3 mb-6">
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
          >
            «{query}»
          </h2>
          <span className="text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
            {total} результатов · стр. {currentPage}/{pages || 1}
          </span>
        </div>
      )}

      {loading && <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>Поиск...</p>}
      {error && <p className="text-center py-16" style={{ color: 'var(--c-red)' }}>{error}</p>}

      {!loading && results.length === 0 && query && (
        <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>Ничего не найдено</p>
      )}

      <div className="space-y-3 stagger-children">
        {results.map((plot, i) => (
          <Link
            key={plot._id}
            to={`/plots/${plot._id}`}
            className="card-hover block rounded-xl p-4 transition-all duration-200"
            style={{
              background: 'var(--c-card)',
              border: '1px solid var(--c-border)',
            }}
          >
            <div className="flex gap-4">
              {/* Rank number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--c-accent-dim)', color: 'var(--c-accent)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem' }}>
                {(currentPage - 1) * 20 + i + 1}
              </div>

              {plot.thumbnail && (
                <img
                  src={plot.thumbnail}
                  alt={plot.title}
                  className="w-28 h-20 object-cover rounded-lg flex-shrink-0"
                  style={{ border: '1px solid var(--c-border)' }}
                  loading="lazy"
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm line-clamp-1" style={{ color: 'var(--c-heading)', fontFamily: 'var(--font-body)' }}>
                      {plot.title}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                      {plot.location || plot.address}
                    </p>
                  </div>
                  <span className="text-base font-bold whitespace-nowrap" style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}>
                    {formatPrice(plot.price)}
                  </span>
                </div>

                <p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'var(--c-text-muted)' }}>
                  {plot.description}
                </p>

                {/* Score badges */}
                <div className="flex items-center gap-3 mt-2">
                  <MiniGauge value={plot.total_score} color="var(--c-accent)" />
                  {plot.jina_score != null && (
                    <span className="text-xs px-2 py-0.5 rounded-md"
                      style={{ background: 'var(--c-blue-dim)', color: 'var(--c-blue)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                      Jina {(plot.jina_score * 100).toFixed(0)}
                    </span>
                  )}
                  {plot.search_score != null && (
                    <span className="text-xs px-2 py-0.5 rounded-md"
                      style={{ background: 'var(--c-green-dim)', color: 'var(--c-green)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                      Vec {(plot.search_score * 100).toFixed(0)}
                    </span>
                  )}
                  {plot.features_text && (
                    <span className="text-xs truncate" style={{ color: 'var(--c-text-dim)' }}>
                      {plot.features_text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-10">
          <button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="btn-ghost text-sm disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            let p: number;
            if (pages <= 7) {
              p = i + 1;
            } else if (currentPage <= 4) {
              p = i + 1;
            } else if (currentPage >= pages - 3) {
              p = pages - 6 + i;
            } else {
              p = currentPage - 3 + i;
            }
            return (
              <button
                key={p}
                onClick={() => changePage(p)}
                className="w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: p === currentPage ? 'var(--c-accent)' : 'var(--c-surface)',
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
            disabled={currentPage >= pages}
            className="btn-ghost text-sm disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Expand hint: shown on last page when more candidates are available */}
      {canExpand && currentPage === pages && pages > 0 && !loading && (
        <div className="text-center mt-4">
          <button
            onClick={() => changePage(currentPage + 1)}
            className="btn-ghost text-xs"
            style={{ color: 'var(--c-accent)' }}
          >
            Загрузить ещё результаты (Jina rerank) →
          </button>
        </div>
      )}
    </div>
  );
}
