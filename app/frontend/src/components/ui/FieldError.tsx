type FieldErrorProps = {
  readonly message?: string;
  readonly className?: string;
};

export function FieldError({ message, className }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p className={className ?? 'text-xs mt-1'} style={{ color: 'var(--c-red)' }}>
      {message}
    </p>
  );
}