import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Heart } from 'lucide-react';

import { ApiError, fetchPlot, type Plot } from '../api';

function isMissingError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
import { PageHeader } from '../components/PageHeader';
import ScoreGauge from '../components/ScoreGauge';
import { Button, Surface } from '../components/ui';
import { formatPrice, getErrorMessage } from '../utils';
import { useUserPrefsStore } from '../stores/userPrefsStore';

export default function Favorites() {
  const favoritePlotIds = useUserPrefsStore((state) => state.favoritePlotIds);
  const toggleFavorite = useUserPrefsStore((state) => state.toggleFavorite);

  const queries = useQueries({
    queries: favoritePlotIds.map((id) => ({
      queryKey: ['plots', 'detail', id],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchPlot(id, signal),
      retry: (_count: number, error: unknown) => !isMissingError(error),
    })),
  });

  useEffect(() => {
    queries.forEach((query, index) => {
      if (isMissingError(query.error)) {
        const staleId = favoritePlotIds[index];
        if (staleId) toggleFavorite(staleId);
      }
    });
  }, [queries, favoritePlotIds, toggleFavorite]);

  const isLoading = queries.some((query) => query.isLoading);
  const nonMissingError = queries.find(
    (query) => query.error && !isMissingError(query.error),
  )?.error;
  const missingCount = queries.filter((query) => isMissingError(query.error)).length;
  const plots = useMemo(
    () => queries.map((query) => query.data).filter((plot): plot is Plot => Boolean(plot)),
    [queries],
  );

  if (favoritePlotIds.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Избранное" subtitle="Здесь появятся сохранённые вами объявления" />
        <div className="text-center py-16">
          <p style={{ color: 'var(--c-text-dim)' }}>Пока ничего не добавлено в избранное</p>
          <Link to="/" className="text-sm mt-3 inline-block" style={{ color: 'var(--c-accent)' }}>
            Перейти в каталог
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Избранное"
        subtitle={`${favoritePlotIds.length} ${favoritePlotIds.length === 1 ? 'объявление' : 'объявлений'} сохранено`}
      />

      {isLoading && !plots.length && (
        <p className="py-12 text-center" style={{ color: 'var(--c-text-dim)' }}>Загрузка избранного...</p>
      )}
      {nonMissingError && (
        <p className="py-12 text-center" style={{ color: 'var(--c-red)' }}>{getErrorMessage(nonMissingError)}</p>
      )}
      {missingCount > 0 && (
        <p className="mb-4 text-xs" style={{ color: 'var(--c-text-dim)' }}>
          Убрано из избранного {missingCount} {missingCount === 1 ? 'объявление' : 'объявлений'} — их больше нет в базе
        </p>
      )}

      {plots.length > 0 && (
        <div className="space-y-3 stagger-children">
          {plots.map((plot) => (
            <Surface key={plot._id} className="flex items-center gap-4 p-4 row-hover">
              {plot.thumbnail && (
                <img
                  src={plot.thumbnail}
                  alt=""
                  className="w-20 h-14 object-cover rounded-lg shrink-0"
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
              <div className="flex items-center gap-4 shrink-0">
                <ScoreGauge value={plot.total_score} size={28} color="var(--c-accent)" />
                <span
                  className="text-sm font-bold"
                  style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}
                >
                  {formatPrice(plot.price)}
                </span>
                <Button
                  onClick={() => toggleFavorite(plot._id)}
                  variant="ghost"
                  size="icon"
                  className="p-2 rounded-lg"
                  style={{ color: 'var(--c-red)', background: 'var(--c-red-dim)' }}
                  aria-label="Убрать из избранного"
                  title="Убрать из избранного"
                >
                  <Heart size={24} fill="currentColor" />
                </Button>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
