import { Surface } from '../ui';

const SKELETON_CARD_IDS = ['one', 'two', 'three', 'four', 'five', 'six'] as const;

export function RouteSkeleton() {
  return (
    <div className="max-w-6xl mx-auto py-4 animate-fade-in" role="status" aria-live="polite" aria-label="Загрузка страницы">
      <div className="h-10 w-64 rounded-lg mb-4 animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
      <div className="h-4 w-md max-w-full rounded-md mb-8 animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {SKELETON_CARD_IDS.map((id) => (
          <Surface key={id} className="overflow-hidden">
            <div className="h-40 animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
            <div className="p-4 space-y-3">
              <div className="h-4 rounded-md animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
              <div className="h-4 rounded-md w-4/5 animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
              <div className="h-8 rounded-md animate-pulse" style={{ background: 'var(--c-surface-hover)' }} />
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}
