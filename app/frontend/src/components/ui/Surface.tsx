import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

type SurfaceProps = Readonly<HTMLAttributes<HTMLDivElement>>;

export function Surface({ className, style, ...props }: SurfaceProps) {
  return (
    <div
      className={cn('rounded-2xl border backdrop-blur-sm', className)}
      style={{
        background: 'color-mix(in srgb, var(--c-card) 86%, transparent)',
        borderColor: 'var(--c-border)',
        boxShadow: '0 12px 34px -24px rgba(0, 0, 0, 0.72)',
        ...style,
      }}
      {...props}
    />
  );
}