import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';

type SectionTitleProps = Omit<HTMLAttributes<HTMLHeadingElement>, 'children'> & {
  readonly children: ReactNode;
  readonly toneStyle?: CSSProperties;
};

export function SectionTitle({
  children,
  className,
  style,
  toneStyle,
  ...props
}: Readonly<SectionTitleProps>) {
  return (
    <h2
      className={cn('text-lg font-semibold', className)}
      style={{
        fontFamily: 'var(--font-display)',
        color: 'var(--c-heading)',
        ...toneStyle,
        ...style,
      }}
      {...props}
    >
      {children}
    </h2>
  );
}
