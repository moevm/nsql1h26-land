import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Pencil, Heart, GitCompare } from 'lucide-react';
import { formatPriceFull, getErrorMessage } from '../utils';
import { AlertMessage } from '../components/AlertMessage';
import ScoreGauge from '../components/ScoreGauge';
import { SectionTitle } from '../components/SectionTitle';
import { useAuth } from '../contexts/AuthContext';
import {
  useDeletePlotMutation,
  useLocationStatsQuery,
  usePlotQuery,
  usePriceHistoryQuery,
  useSellerProfileQuery,
} from '../features/plots/hooks';
import { useUserPrefsStore } from '../stores/userPrefsStore';
import { Button, Surface } from '../components/ui';
import PriceHistoryChart from '../components/PriceHistoryChart';
import DistanceList from '../components/DistanceList';
import SellerProfileCard from '../components/SellerProfileCard';

const DATE_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function formatDate(value: string | undefined, options: Intl.DateTimeFormatOptions): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('ru-RU', options);
}

function MetaRow({ label, value }: { readonly label: string; readonly value: string | null }) {
  if (!value) return null;
  return (
    <p className="flex items-start gap-2">
      <span style={{ color: 'var(--c-text-dim)' }}>{label}:</span>
      <span style={{ color: 'var(--c-text)' }}>{value}</span>
    </p>
  );
}

export default function PlotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [actionError, setActionError] = useState('');

  const isFavorite = useUserPrefsStore((state) => (id ? state.isFavorite(id) : false));
  const isCompared = useUserPrefsStore((state) => (id ? state.isCompared(id) : false));
  const toggleFavorite = useUserPrefsStore((state) => state.toggleFavorite);
  const toggleCompare = useUserPrefsStore((state) => state.toggleCompare);

  const plotQuery = usePlotQuery(id ?? '');
  const deleteMutation = useDeletePlotMutation({
    onSuccess: () => {
      navigate('/');
    },
  });

  const plot = plotQuery.data;
  const loading = plotQuery.isLoading;
  const error = plotQuery.error ? getErrorMessage(plotQuery.error) : '';

  const priceHistoryQuery = usePriceHistoryQuery(plot?._id ?? '');
  const locationStatsQuery = useLocationStatsQuery(plot?.location);
  const sellerProfileQuery = useSellerProfileQuery(plot?.owner_name);
  const sellerProfileError = sellerProfileQuery.error ? getErrorMessage(sellerProfileQuery.error) : '';

  const canEdit = plot && user && (isAdmin || plot.owner_id === user._id);
  const canDelete = canEdit;

  async function handleDelete() {
    if (!id || !confirm('Удалить объявление?')) return;
    setActionError('');
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setActionError(getErrorMessage(e));
    }
  }

  if (loading) return <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }} role="status" aria-live="polite">Загрузка...</p>;
  if (error) return <p className="text-center py-16" style={{ color: 'var(--c-red)' }} role="alert">{error}</p>;
  if (!plot) return <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>Не найдено</p>;

  const createdDateLabel = formatDate(plot.created_at, DATE_LABEL_OPTIONS);
  const updatedDateLabel = formatDate(plot.updated_at, DATE_LABEL_OPTIONS);
  const createdDateTime = formatDate(plot.created_at, DATE_TIME_OPTIONS);
  const updatedDateTime = formatDate(plot.updated_at, DATE_TIME_OPTIONS);

  return (
    <div className="animate-fade-in-up max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
        >
          <ArrowLeft size={16} className="inline-block" /> Назад
        </Button>
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
            <Button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              variant="danger"
              size="sm"
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {id && (
          <>
            <Button
              type="button"
              onClick={() => toggleFavorite(id)}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
              style={{
                color: isFavorite ? 'var(--c-red)' : 'var(--c-text-muted)',
                borderColor: isFavorite ? 'var(--c-red)' : 'var(--c-border)',
              }}
              aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            >
              <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
              {isFavorite ? 'В избранном' : 'В избранное'}
            </Button>
            <Button
              type="button"
              onClick={() => toggleCompare(id)}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
              style={{
                color: isCompared ? 'var(--c-blue)' : 'var(--c-text-muted)',
                borderColor: isCompared ? 'var(--c-blue)' : 'var(--c-border)',
              }}
              aria-label={isCompared ? 'Убрать из сравнения' : 'Добавить в сравнение'}
            >
              <GitCompare size={14} />
              {isCompared ? 'В сравнении' : 'Добавить в сравнение'}
            </Button>
          </>
        )}
      </div>

      <AlertMessage message={actionError} />

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
        {(createdDateLabel || updatedDateLabel) && (
          <p className="text-xs mt-2" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
            {updatedDateLabel ? `Изменено ${updatedDateLabel}` : createdDateLabel ? `Создано ${createdDateLabel}` : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-5">
          {plot.thumbnail && (
            <Surface className="overflow-hidden">
              <img src={plot.thumbnail} alt={plot.title} className="w-full max-h-80 object-cover" />
            </Surface>
          )}

          <Surface className="p-5">
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
          </Surface>

          <PriceHistoryChart
            data={priceHistoryQuery.data ?? []}
            isLoading={priceHistoryQuery.isLoading}
          />

          <Surface className="p-5">
            <SectionTitle className="mb-3">Районная аналитика</SectionTitle>
            {locationStatsQuery.isLoading && (
              <p className="text-sm" style={{ color: 'var(--c-text-dim)' }}>Считаем статистику локации...</p>
            )}
            {locationStatsQuery.data && (
              <div className="space-y-1 text-sm" style={{ color: 'var(--c-text)' }}>
                <p>Выборка: {locationStatsQuery.data.sample_size} объявлений</p>
                <p>
                  Средняя цена за сотку: {locationStatsQuery.data.avg_price_per_sotka
                    ? formatPriceFull(locationStatsQuery.data.avg_price_per_sotka)
                    : '—'}
                </p>
                <p>
                  Медианная цена за сотку: {locationStatsQuery.data.median_price_per_sotka
                    ? formatPriceFull(locationStatsQuery.data.median_price_per_sotka)
                    : '—'}
                </p>
                <p>Средний общий скор: {locationStatsQuery.data.avg_total_score?.toFixed(3) ?? '—'}</p>
              </div>
            )}
          </Surface>

          <Surface className="p-5">
            <SectionTitle className="mb-3">Описание</SectionTitle>
            <p className="whitespace-pre-line leading-relaxed text-sm" style={{ color: 'var(--c-text)' }}>
              {plot.description}
            </p>
          </Surface>

          {plot.features_text && (
            <Surface className="p-5">
              <SectionTitle className="mb-3">Характеристики</SectionTitle>
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
            </Surface>
          )}

          {plot.url && (
            <a
              href={plot.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm motion-unified"
              style={{ color: 'var(--c-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-accent)'}
            >
              Посмотреть на Авито <ExternalLink size={14} className="inline-block ml-1" />
            </a>
          )}
        </div>

        <div className="lg:col-span-2 space-y-5">
          <Surface className="p-5">
            <SectionTitle className="mb-5">Аналитика</SectionTitle>
            <div className="grid grid-cols-2 gap-4 justify-items-center">
              <ScoreGauge value={plot.total_score} label="Общий" size={80} color="var(--c-accent)" />
              <ScoreGauge value={plot.infra_score} label="Инфра" size={80} color="var(--c-blue)" />
              <ScoreGauge value={plot.negative_score} label="Экология" size={80} color="var(--c-green)" />
              <ScoreGauge value={plot.feature_score} label="Хар-ки" size={80} color="var(--c-yellow)" />
            </div>
          </Surface>

          {plot.distances && <DistanceList distances={plot.distances} />}

          <SellerProfileCard
            profile={sellerProfileQuery.data}
            isLoading={sellerProfileQuery.isLoading}
            error={sellerProfileError}
            ownerName={plot.owner_name}
          />

          <Surface
            className="p-5 text-xs"
            style={{
              color: 'var(--c-text-dim)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <SectionTitle className="mb-3">Служебные данные</SectionTitle>
            <div className="space-y-1.5">
              <MetaRow
                label="Координаты"
                value={plot.lat !== undefined && plot.lon !== undefined ? `${plot.lat.toFixed(6)}, ${plot.lon.toFixed(6)}` : null}
              />
              <MetaRow label="AVITO ID" value={plot.avito_id ? String(plot.avito_id) : null} />
              <MetaRow label="OWNER" value={plot.owner_name || null} />
              <MetaRow label="Создано" value={createdDateTime} />
              <MetaRow label="Изменено" value={updatedDateTime} />
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
