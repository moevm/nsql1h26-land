import type { HTMLAttributes, LabelHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

type FieldLabelProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, 'htmlFor'> & {
  readonly htmlFor: string;
};

type FieldCaptionProps = HTMLAttributes<HTMLSpanElement>;

const baseStyle = { color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' };

export function FieldLabel({ className, ...props }: Readonly<FieldLabelProps>) {
  return (
    <label
      className={cn(
        'block text-xs mb-1.5 uppercase tracking-wide',
        className,
      )}
      style={baseStyle}
      {...props}
    />
  );
}

export function FieldCaption({ className, ...props }: Readonly<FieldCaptionProps>) {
  return (
    <span
      className={cn(
    'block text-xs mb-1.5 uppercase tracking-wide',
    className,
      )}
      style={baseStyle}
      {...props}
    />
  );
}