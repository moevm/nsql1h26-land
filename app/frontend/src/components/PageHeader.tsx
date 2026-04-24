import type { CSSProperties, ReactNode } from 'react';

import { cn } from '../lib/cn';

type PageHeaderProps = {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly className?: string;
  readonly titleClassName?: string;
  readonly subtitleClassName?: string;
  readonly titleStyle?: CSSProperties;
  readonly subtitleStyle?: CSSProperties;
};

export function PageHeader({
  title,
  subtitle,
  className,
  titleClassName,
  subtitleClassName,
  titleStyle,
  subtitleStyle,
}: Readonly<PageHeaderProps>) {
  return (
    <div className={className}>
      <h1
        className={cn('text-2xl sm:text-3xl font-bold mb-2', titleClassName)}
        style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)', ...titleStyle }}
      >
        {title}
      </h1>
      {subtitle ? (
        <p className={cn('mb-6 text-sm', subtitleClassName)} style={{ color: 'var(--c-text-muted)', ...subtitleStyle }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
