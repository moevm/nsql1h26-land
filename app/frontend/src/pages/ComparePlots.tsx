import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { fetchPlot, type Plot } from '../api';
import { PageHeader } from '../components/PageHeader';
import ScoreGauge from '../components/ScoreGauge';
import { Button } from '../components/ui';
import { formatPrice, formatPriceFull, getErrorMessage } from '../utils';
import { useUserPrefsStore } from '../stores/userPrefsStore';

function toText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  return String(value);
}

export default function ComparePlots() {
  const comparePlotIds = useUserPrefsStore((state) => state.comparePlotIds);
  const toggleCompare = useUserPrefsStore((state) => state.toggleCompare);
  const clearCompare = useUserPrefsStore((state) => state.clearCompare);

  const queries = useQueries({
    queries: comparePlotIds.map((id) => ({
      queryKey: ['plots', 'detail', id],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchPlot(id, signal),
    })),
  });

  const isLoading = queries.some((query) => query.isLoading);
  const firstError = queries.find((query) => query.error)?.error;
  const plots = useMemo(
    () => queries.map((query) => query.data).filter((plot): plot is Plot => Boolean(plot)),
    [queries],
  );

  if (comparePlotIds.length === 0) {
    return (
      <div className="text-center py-20">
        <PageHeader
          title="Сравнение участков"
          subtitle="Добавьте минимум два участка из каталога для сравнения"
          titleClassName="text-2xl text-center"
          subtitleClassName="text-center mb-0"
        />
        <Link to="/" className="btn-primary inline-block mt-6">Перейти в каталог</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Сравнение участков"
          subtitle={`Сравниваем ${comparePlotIds.length} участка по цене, аналитике и инфраструктуре`}
          className="mb-0"
          titleClassName="text-3xl mb-2"
          subtitleClassName="mb-0"
        />
        <Button onClick={clearCompare} variant="ghost" size="sm">Очистить</Button>
      </div>

      {isLoading && <p className="py-12 text-center" style={{ color: 'var(--c-text-dim)' }}>Загрузка данных для сравнения...</p>}
      {firstError && (
        <p className="py-6 text-center" style={{ color: 'var(--c-red)' }}>
          {getErrorMessage(firstError)}
        </p>
      )}

      {!isLoading && !firstError && plots.length > 0 && (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--c-border)' }}>
          <table className="w-full min-w-[860px]" style={{ borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--c-surface)' }}>
              <tr>
                <th className="text-left p-4 text-xs uppercase tracking-wide" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                  Параметр
                </th>
                {plots.map((plot) => (
                  <th key={plot._id} className="p-4 align-top" style={{ borderLeft: '1px solid var(--c-border)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/plots/${plot._id}`} className="text-left" style={{ color: 'var(--c-heading)' }}>
                        <p className="text-sm font-semibold line-clamp-2">{plot.title}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)' }}>
                          {plot.location || plot.address}
                        </p>
                      </Link>
                      <Button
                        onClick={() => toggleCompare(plot._id)}
                        variant="ghost"
                        size="icon"
                        className="p-1 rounded"
                        style={{ color: 'var(--c-text-dim)' }}
                        aria-label="Убрать из сравнения"
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: 'Общий скор',
                  render: (plot: Plot) => <ScoreGauge value={plot.total_score} size={52} color="var(--c-accent)" />,
                },
                {
                  label: 'Цена',
                  render: (plot: Plot) => <span style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}>{formatPrice(plot.price)}</span>,
                },
                {
                  label: 'Цена за сотку',
                  render: (plot: Plot) => toText(plot.price_per_sotka ? `${formatPriceFull(plot.price_per_sotka)}/сот.` : null),
                },
                {
                  label: 'Площадь',
                  render: (plot: Plot) => toText(plot.area_sotki ? `${plot.area_sotki} сот.` : null),
                },
                {
                  label: 'Скор инфраструктуры',
                  render: (plot: Plot) => toText(plot.infra_score.toFixed(3)),
                },
                {
                  label: 'Экологический скор',
                  render: (plot: Plot) => toText(plot.negative_score.toFixed(3)),
                },
                {
                  label: 'Скор характеристик',
                  render: (plot: Plot) => toText(plot.feature_score.toFixed(3)),
                },
                {
                  label: 'Характеристики',
                  render: (plot: Plot) => (
                    <span className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
                      {plot.features_text || '—'}
                    </span>
                  ),
                },
                {
                  label: 'Владелец',
                  render: (plot: Plot) => toText(plot.owner_name),
                },
              ].map((row) => (
                <tr key={row.label} style={{ borderTop: '1px solid var(--c-border)' }}>
                  <td className="p-4 text-sm" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {row.label}
                  </td>
                  {plots.map((plot) => (
                    <td key={`${row.label}:${plot._id}`} className="p-4 align-middle text-sm" style={{ borderLeft: '1px solid var(--c-border)' }}>
                      {row.render(plot)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
