import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { fetchMyPlots, deletePlot, type Plot, type PlotsListResponse } from '../api';
import { formatPrice, getErrorMessage } from '../utils';
import ScoreGauge from '../components/ScoreGauge';
import Pagination from '../components/Pagination';
import { useAuth } from '../contexts/AuthContext';

export default function MyPlots() {
  const { user } = useAuth();
  const [data, setData] = useState<PlotsListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--c-text-dim)' }}>Необходимо войти в систему</p>
        <Link to="/login" className="text-sm mt-3 inline-block" style={{ color: 'var(--c-accent)' }}>
          Войти
        </Link>
      </div>
    );
  }

  async function load(p: number) {
    setLoading(true);
    setError('');
    try {
      const res = await fetchMyPlots(p);
      setData(res);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page); }, [page]);

  async function handleDelete(id: string) {
    if (!confirm('Удалить объявление?')) return;
    try {
      await deletePlot(id);
      load(page);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <div className="animate-fade-in">
      <h1
        className="text-2xl sm:text-3xl font-bold mb-2"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
      >
        Мои объявления
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--c-text-muted)' }}>
        {data ? `${data.total} объявлений` : 'Загрузка…'}
      </p>

      {error && (
        <div className="px-4 py-3 rounded-xl mb-5 text-sm" style={{ background: 'var(--c-red-dim)', color: 'var(--c-red)', border: '1px solid var(--c-red)' }}>
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>Загрузка…</div>
      )}

      {data && data.items.length === 0 && (
        <div className="text-center py-16">
          <p style={{ color: 'var(--c-text-dim)' }}>У вас пока нет объявлений</p>
          <Link to="/add" className="text-sm mt-3 inline-block" style={{ color: 'var(--c-accent)' }}>
            Создать первое
          </Link>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="space-y-3 stagger-children">
            {data.items.map((plot: Plot) => (
              <div
                key={plot._id}
                className="flex items-center gap-4 rounded-xl p-4 transition-colors duration-200 row-hover"
                style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
              >
                {plot.thumbnail && (
                  <img
                    src={plot.thumbnail}
                    alt=""
                    className="w-20 h-14 object-cover rounded-lg flex-shrink-0"
                    style={{ border: '1px solid var(--c-border)' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/plots/${plot._id}`}
                    className="text-sm font-semibold truncate block"
                    style={{ color: 'var(--c-heading)' }}
                  >
                    {plot.title}
                  </Link>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                    {plot.location || plot.address}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <ScoreGauge value={plot.total_score} size={28} color="var(--c-accent)" />
                  <span className="text-sm font-bold" style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}>
                    {formatPrice(plot.price)}
                  </span>
                  <Link
                    to={`/plots/${plot._id}/edit`}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--c-blue-dim)', color: 'var(--c-blue)' }}
                  >
                    Изменить
                  </Link>
                  <button
                    onClick={() => handleDelete(plot._id)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--c-text-dim)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-red)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-text-dim)'}
                    title="Удалить"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {data.pages > 1 && (
            <div className="mt-6">
              <Pagination currentPage={page} totalPages={data.pages} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
