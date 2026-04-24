export const SPB_CENTER: [number, number] = [59.93, 30.32];

export function formatPrice(p: number): string {
  if (p >= 1_000_000) return (p / 1_000_000).toFixed(1).replace('.0', '') + ' млн ₽';
  if (p >= 1_000) return (p / 1_000).toFixed(0) + ' тыс ₽';
  return p.toLocaleString('ru-RU') + ' ₽';
}

export function formatPriceFull(p: number): string {
  return p.toLocaleString('ru-RU') + ' ₽';
}

export function scoreColor(score: number): string {
  if (score >= 0.7) return 'var(--c-green)';
  if (score >= 0.4) return 'var(--c-yellow)';
  return 'var(--c-red)';
}

export function scoreHexColor(score: number): string {
  if (score >= 0.7) return '#5cb08a';
  if (score >= 0.4) return '#c9a84c';
  return '#c75f5f';
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
