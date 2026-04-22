import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { type Plot } from '../api';
import { formatPrice, getErrorMessage } from '../utils';
import { AlertMessage } from '../components/AlertMessage';
import { PageHeader } from '../components/PageHeader';
import ScoreGauge from '../components/ScoreGauge';
import Pagination from '../components/Pagination';
import { Button, Surface } from '../components/ui';
import { useDeletePlotMutation, useMyPlotsQuery } from '../features/plots/hooks';

export default function MyPlots() {
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState('');

  const myPlotsQuery = useMyPlotsQuery({
    page,
    pageSize: 20,
    sort: 'created_at',
    order: 'desc',
  });

  const deleteMutation = useDeletePlotMutation();

  const data = myPlotsQuery.data ?? null;
  const loading = myPlotsQuery.isLoading;
  const error = myPlotsQuery.error ? getErrorMessage(myPlotsQuery.error) : '';

  // Синхронизируем локальную страницу с ответом сервера только после
  // завершения запроса (иначе placeholderData сбрасывает пользователя
  // на предыдущую страницу во время fetch).
  useEffect(() => {
    if (!data || myPlotsQuery.isFetching) return;
    if (data.page !== page) {
      setPage(data.page);
    }
  }, [data, myPlotsQuery.isFetching, page]);

  async function handleDelete(id: string) {
    if (!confirm('Удалить объявление?')) return;
    setActionError('');
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      setActionError(getErrorMessage(e));
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Мои объявления"
        subtitle={data ? `${data.total} объявлений` : 'Загрузка…'}
      />

      <AlertMessage message={error} />
      <AlertMessage message={actionError} />

      {loading && !data && (
        <div className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>Загрузка…</div>
      )}

      {data?.items.length === 0 && (
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
              <Surface
                key={plot._id}
                className="flex items-center gap-4 p-4 row-hover"
              >
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
                  <Button
                    onClick={() => handleDelete(plot._id)}
                    disabled={deleteMutation.isPending}
                    variant="ghost"
                    size="icon"
                    className="p-2 rounded-lg"
                    style={{ color: 'var(--c-text-dim)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-red)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-text-dim)'}
                    title="Удалить"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </Surface>
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
