import { cn } from '../lib/cn';

type CoordinateBadgeProps = {
  readonly lat: number | null;
  readonly lon: number | null;
  readonly className?: string;
};

export function CoordinateBadge({ lat, lon, className }: Readonly<CoordinateBadgeProps>) {
  if (lat === null || lon === null) {
    return null;
  }

  return (
    <span
      className={cn('text-xs px-3 py-1 rounded-lg', className)}
      style={{
        background: 'var(--c-green-dim)',
        color: 'var(--c-green)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {lat.toFixed(6)}, {lon.toFixed(6)}
    </span>
  );
}
