import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { TrainFront, Hospital, School, Baby, ShoppingCart, Package, Bus, AlertTriangle, ArrowLeft, ExternalLink, Pencil } from 'lucide-react';
import { fetchPlot, deletePlot, type Plot } from '../api';
import { formatPriceFull, getErrorMessage } from '../utils';
import ScoreGauge from '../components/ScoreGauge';
import { useAuth } from '../contexts/AuthContext';
import { getCached, setCache, invalidateCache } from '../cache';

function distanceColor(km: number): string {
  if (km < 5) return 'var(--c-green)';
  if (km < 15) return 'var(--c-yellow)';
  return 'var(--c-red)';
}

function DistanceRow({ icon: Icon, label, name, km }: { readonly icon: React.ElementType; readonly label: string; readonly name: string; readonly km: number }) {
  const color = distanceColor(km);
  return (
    <div
      className="flex items-center justify-between py-3 px-4 rounded-lg transition-colors duration-200 row-hover"
      style={{ borderBottom: '1px solid var(--c-border)' }}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} style={{ color: 'var(--c-text-muted)', flexShrink: 0 }} />
        <div>
          <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>{label}</span>
          <p className="text-sm" style={{ color: 'var(--c-text)' }}>{name || '—'}</p>
        </div>
      </div>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color, fontFamily: 'var(--font-mono)' }}
      >
        {km.toFixed(1)} км
      </span>
    </div>
  );
}

export default function PlotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [plot, setPlot] = useState<Plot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canEdit = plot && user && (isAdmin || plot.owner_id === user._id);
  const canDelete = canEdit;

  useEffect(() => {
    if (!id) return;
    const cacheKey = `plot:${id}`;
    const cached = getCached<Plot>(cacheKey, 120_000);
    if (cached) {
      setPlot(cached);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    fetchPlot(id, controller.signal)
      .then((p) => { setPlot(p); setCache(cacheKey, p); })
      .catch((e) => {
        if (!controller.signal.aborted) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  async function handleDelete() {
    if (!id || !confirm('Удалить объявление?')) return;
    setDeleting(true);
    try {
      await deletePlot(id);
      invalidateCache('plots');
      invalidateCache('plot:');
      invalidateCache('map-plots');
      navigate('/');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>Загрузка...</p>;
  if (error) return <p className="text-center py-16" style={{ color: 'var(--c-red)' }}>{error}</p>;
  if (!plot) return <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>Не найдено</p>;

  const d = plot.distances ?? {} as Record<string, never>;

  return (
    <div className="animate-fade-in-up max-w-5xl mx-auto">
      {/* Back + edit + delete */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="btn-ghost text-sm flex items-center gap-2"
        >
          <ArrowLeft size={16} className="inline-block" /> Назад
        </button>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              to={`/plots/${id}/edit`}
              className="btn-ghost text-sm flex items-center gap-2"
              style={{ color: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
            >
              <Pencil size={14} /> Редактировать
            </Link>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-danger text-sm"
            >
              {deleting ? 'Удаление...' : 'Удалить'}
            </button>
          )}
        </div>
      </div>

      {/* Title section */}
      <div className="mb-8">
        <h1
          className="text-2xl sm:text-3xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
        >
          {plot.title}
        </h1>
        <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
          {plot.location} · {plot.address}
        </p>
        {(plot.created_at || plot.updated_at) && (
          <p className="text-xs mt-2" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
            {plot.updated_at
              ? `Изменено ${new Date(plot.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : plot.created_at
                ? `Создано ${new Date(plot.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: info (3 cols) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Image */}
          {plot.thumbnail && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
              <img src={plot.thumbnail} alt={plot.title} className="w-full max-h-80 object-cover" />
            </div>
          )}

          {/* Price & area */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-baseline gap-4 flex-wrap">
              <span
                className="text-2xl font-bold"
                style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}
              >
                {formatPriceFull(plot.price)}
              </span>
              {plot.area_sotki && (
                <span className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
                  {plot.area_sotki} сот.
                </span>
              )}
              {plot.price_per_sotka && (
                <span
                  className="text-xs px-2 py-1 rounded-md"
                  style={{
                    background: 'var(--c-accent-dim)',
                    color: 'var(--c-accent)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {formatPriceFull(plot.price_per_sotka)}/сот.
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            <h2
              className="text-lg font-semibold mb-3"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
            >
              Описание
            </h2>
            <p className="whitespace-pre-line leading-relaxed text-sm" style={{ color: 'var(--c-text)' }}>
              {plot.description}
            </p>
          </div>

          {/* Features */}
          {plot.features_text && (
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
            >
              <h2
                className="text-lg font-semibold mb-3"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
              >
                Характеристики
              </h2>
              <div className="flex flex-wrap gap-2">
                {plot.features_text.split(', ').map((f) => (
                  <span
                    key={f}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{
                      background: 'var(--c-accent-dim)',
                      color: 'var(--c-accent)',
                      border: '1px solid rgba(212,165,116,0.2)',
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* URL */}
          {plot.url && (
            <a
              href={plot.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm transition-colors duration-200"
              style={{ color: 'var(--c-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-accent)'}
            >
              Посмотреть на Авито <ExternalLink size={14} className="inline-block ml-1" />
            </a>
          )}
        </div>

        {/* Right: analytics (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Score gauges */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            <h2
              className="text-lg font-semibold mb-5"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
            >
              Аналитика
            </h2>
            <div className="grid grid-cols-2 gap-4 justify-items-center">
              <ScoreGauge value={plot.total_score} label="Общий" size={80} color="var(--c-accent)" />
              <ScoreGauge value={plot.infra_score} label="Инфра" size={80} color="var(--c-blue)" />
              <ScoreGauge value={plot.negative_score} label="Экология" size={80} color="var(--c-green)" />
              <ScoreGauge value={plot.feature_score} label="Хар-ки" size={80} color="var(--c-yellow)" />
            </div>
          </div>

          {/* Distances */}
          {plot.distances && (
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
          >
            <h2
              className="text-lg font-semibold mb-3"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
            >
              Расстояния
            </h2>
            <div className="space-y-0">
              <DistanceRow icon={TrainFront} label="МЕТРО" name={d.nearest_metro?.name} km={d.nearest_metro?.km} />
              <DistanceRow icon={Hospital} label="БОЛЬНИЦА" name={d.nearest_hospital?.name} km={d.nearest_hospital?.km} />
              <DistanceRow icon={School} label="ШКОЛА" name={d.nearest_school?.name} km={d.nearest_school?.km} />
              <DistanceRow icon={Baby} label="ДЕТСАД" name={d.nearest_kindergarten?.name} km={d.nearest_kindergarten?.km} />
              <DistanceRow icon={ShoppingCart} label="МАГАЗИН" name={d.nearest_store?.name} km={d.nearest_store?.km} />
              <DistanceRow icon={Package} label="ПВЗ" name={d.nearest_pickup_point?.name} km={d.nearest_pickup_point?.km} />
              <DistanceRow icon={Bus} label="АВТОБУС" name={d.nearest_bus_stop?.name} km={d.nearest_bus_stop?.km} />
              <DistanceRow icon={AlertTriangle} label="НЕГАТИВ" name={d.nearest_negative?.name} km={d.nearest_negative?.km} />
            </div>
          </div>
          )}

          {/* Coordinates */}
          <div
            className="rounded-xl p-4 text-xs"
            style={{
              background: 'var(--c-card)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-text-dim)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <p>COORD {plot.lat?.toFixed(6)}, {plot.lon?.toFixed(6)}</p>
            {plot.avito_id && <p className="mt-1">AVITO #{plot.avito_id}</p>}
            {plot.owner_name && <p className="mt-1">OWNER: {plot.owner_name}</p>}
            {plot.created_at && <p className="mt-1">СОЗДАНО: {new Date(plot.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
            {plot.updated_at && <p className="mt-1">ИЗМЕНЕНО: {new Date(plot.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
