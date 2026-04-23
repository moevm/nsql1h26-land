import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Heart, GitCompare } from 'lucide-react';
import { type Plot } from '../api';
import { formatPrice } from '../utils';
import ScoreGauge from './ScoreGauge';
import { Button, Surface } from './ui';
import { useUserPrefsStore } from '../stores/userPrefsStore';

export function PlotCard({
  plot,
  index,
  semanticMode,
  onPrefetchDetail,
}: {
  readonly plot: Plot;
  readonly index: number;
  readonly semanticMode: boolean;
  readonly onPrefetchDetail?: (id: string) => Promise<unknown>;
}) {
  const isFavorite = useUserPrefsStore((state) => state.isFavorite(plot._id));
  const isCompared = useUserPrefsStore((state) => state.isCompared(plot._id));
  const toggleFavorite = useUserPrefsStore((state) => state.toggleFavorite);
  const toggleCompare = useUserPrefsStore((state) => state.toggleCompare);
  const prefetchDetail = () => {
    if (onPrefetchDetail) {
      void onPrefetchDetail(plot._id);
    }
  };

  return (
    <article
      className="card-hover rounded-xl overflow-hidden h-full flex flex-col"
      style={{
        background: 'var(--c-card)',
        border: '1px solid var(--c-border)',
        animationDelay: `${index * 60}ms`,
      }}
    >
      <Link
        to={`/plots/${plot._id}`}
        className="block flex-1 min-h-0"
        onMouseEnter={prefetchDetail}
        onFocus={prefetchDetail}
        onTouchStart={prefetchDetail}
      >
      {plot.thumbnail ? (
        <div className="relative h-44 overflow-hidden">
          <img
            src={plot.thumbnail}
            alt={plot.title}
            className="w-full h-full object-cover motion-transform hover:scale-105"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, var(--c-card) 0%, transparent 50%)',
            }}
          />
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

      <div className="p-4 h-full flex flex-col">
        <h3
          className="font-semibold mb-1 line-clamp-2 text-sm leading-snug"
          style={{ color: 'var(--c-heading)', fontFamily: 'var(--font-body)', fontWeight: 600 }}
        >
          {plot.title}
        </h3>
        <p className="text-xs mb-3 truncate" style={{ color: 'var(--c-text-muted)' }}>
          {plot.location || plot.address}
        </p>

        <div
          className="mb-3 px-3 py-2.5 rounded-lg"
          style={{
            border: '1px solid var(--c-border)',
            background: 'color-mix(in srgb, var(--c-surface) 88%, transparent)',
          }}
        >
          <div className="flex items-end justify-between gap-2">
            <span
              className="text-lg font-bold"
              style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}
            >
              {formatPrice(plot.price)}
            </span>
            {plot.area_sotki && (
              <span
                className="text-xs whitespace-nowrap"
                style={{ color: 'var(--c-text-dim)' }}
              >
                {plot.area_sotki} сот.
              </span>
            )}
          </div>
          {plot.price_per_sotka && (
            <p className="mt-1 text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
              {formatPrice(plot.price_per_sotka)}/сот.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-auto">
          {[
            { v: plot.infra_score, l: 'Инфра', c: 'var(--c-blue)' },
            { v: plot.negative_score, l: 'Эко', c: 'var(--c-green)' },
            { v: plot.feature_score, l: 'Хар-ки', c: 'var(--c-accent)' },
          ].map((s) => (
            <span
              key={s.l}
              className="text-[10px] px-2 py-0.5 rounded-md whitespace-nowrap"
              style={{
                background: `color-mix(in srgb, ${s.c} 12%, transparent)`,
                color: s.c,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {s.l} {(s.v * 100).toFixed(0)}
            </span>
          ))}
          {semanticMode && plot.jina_score != null && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md whitespace-nowrap"
              style={{
                background: 'var(--c-blue-dim)',
                color: 'var(--c-blue)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Jina {(plot.jina_score * 100).toFixed(0)}
            </span>
          )}
          {semanticMode && plot.combined_score != null && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md whitespace-nowrap"
              style={{
                background: 'var(--c-green-dim)',
                color: 'var(--c-green)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Комб {(plot.combined_score * 100).toFixed(0)}
            </span>
          )}
        </div>
      </div>

      </Link>

      <div
        className="px-4 pb-4 pt-3 grid grid-cols-2 gap-2"
        style={{ borderTop: '1px solid var(--c-border)' }}
      >
        <Button
          onClick={() => toggleFavorite(plot._id)}
          variant="ghost"
          size="sm"
          className="w-full text-[11px] sm:text-xs px-2.5 py-1.5 rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap"
          style={{
            background: isFavorite ? 'var(--c-red-dim)' : 'var(--c-surface)',
            color: isFavorite ? 'var(--c-red)' : 'var(--c-text-muted)',
          }}
          aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
        >
          <Heart size={12} fill={isFavorite ? 'currentColor' : 'none'} />
          {isFavorite ? 'В избранном' : 'Избранное'}
        </Button>
        <Button
          onClick={() => toggleCompare(plot._id)}
          variant="ghost"
          size="sm"
          className="w-full text-[11px] sm:text-xs px-2.5 py-1.5 rounded-md flex items-center justify-center gap-1.5 whitespace-nowrap"
          style={{
            background: isCompared ? 'var(--c-blue-dim)' : 'var(--c-surface)',
            color: isCompared ? 'var(--c-blue)' : 'var(--c-text-muted)',
          }}
          aria-label={isCompared ? 'Убрать из сравнения' : 'Добавить в сравнение'}
        >
          <GitCompare size={12} />
          {isCompared ? 'В сравнении' : 'Сравнение'}
        </Button>
      </div>
    </article>
  );
}

export const MemoPlotCard = memo(PlotCard);

const SKELETON_CARD_IDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;

export function PlotCardSkeleton({ index }: { readonly index: number }) {
  return (
    <Surface
      className="overflow-hidden h-full flex flex-col"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="h-44 animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
      <div className="p-4 space-y-3">
        <div className="h-4 rounded-md animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
        <div className="h-4 rounded-md w-4/5 animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
        <div className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
        <div className="flex gap-2">
          <div className="h-5 w-14 rounded-md animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
          <div className="h-5 w-14 rounded-md animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
          <div className="h-5 w-14 rounded-md animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
        </div>
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2 mt-auto">
        <div className="h-8 rounded-md animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
        <div className="h-8 rounded-md animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
      </div>
    </Surface>
  );
}

export function ResultsLoadingScreen({ semanticMode }: { readonly semanticMode: boolean }) {
  return (
    <section className="py-3" role="status" aria-live="polite" aria-label="Загрузка результатов поиска">
      <div className="mb-5">
        <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
          {semanticMode ? 'Выполняем семантический поиск и ранжирование...' : 'Загружаем объявления...'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger-children">
        {SKELETON_CARD_IDS.map((id, index) => (
          <PlotCardSkeleton key={id} index={index} />
        ))}
      </div>
    </section>
  );
}
