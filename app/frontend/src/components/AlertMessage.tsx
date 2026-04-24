import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';

type AlertTone = 'error' | 'success' | 'info';

const toneStyles: Record<AlertTone, CSSProperties> = {
  error: {
    background: 'var(--c-red-dim)',
    color: 'var(--c-red)',
    border: '1px solid var(--c-red)',
  },
  success: {
    background: 'var(--c-green-dim)',
    color: 'var(--c-green)',
    border: '1px solid var(--c-green)',
  },
  info: {
    background: 'var(--c-blue-dim)',
    color: 'var(--c-blue)',
    border: '1px solid var(--c-blue)',
  },
};

type AlertMessageProps = HTMLAttributes<HTMLDivElement> & {
  readonly message?: ReactNode;
  readonly tone?: AlertTone;
};

export function AlertMessage({
  message,
  tone = 'error',
  className,
  style,
  ...props
}: Readonly<AlertMessageProps>) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn('px-4 py-3 rounded-xl mb-5 text-sm', className)}
      style={{ ...toneStyles[tone], ...style }}
      {...props}
    >
      {message}
    </div>
  );
}
