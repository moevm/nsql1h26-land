import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn('input-field', className)}
      {...props}
    />
  ),
);

Input.displayName = 'Input';