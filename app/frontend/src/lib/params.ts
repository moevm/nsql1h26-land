import type { PlotFilters } from '../api';

export const LIST_SORT_FIELDS = new Set([
  'relevance',
  'created_at',
  'price',
  'area_sotki',
  'total_score',
  'price_per_sotka',
  'infra_score',
  'negative_score',
  'feature_score',
]);

export const MY_SORT_FIELDS = new Set([
  'created_at',
  'price',
  'area_sotki',
  'total_score',
  'price_per_sotka',
  'infra_score',
  'feature_score',
]);

export const ORDER_VALUES = new Set(['asc', 'desc']);

export function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

export function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

export function normalizeOrder(order?: string | null): 'asc' | 'desc' {
  return ORDER_VALUES.has(order ?? '') ? (order as 'asc' | 'desc') : 'desc';
}

export function normalizeSort(sort: string | null | undefined, query: string): string {
  const hasQuery = query.trim().length > 0;
  const fallback = hasQuery ? 'relevance' : 'created_at';
  if (!sort || !LIST_SORT_FIELDS.has(sort)) return fallback;
  if (sort === 'relevance' && !hasQuery) return 'created_at';
  return sort;
}

export function normalizeMySort(sort?: string | null): string {
  if (!sort || !MY_SORT_FIELDS.has(sort)) return 'created_at';
  return sort;
}

export function sanitizePlotFilters(filters: PlotFilters = {}): PlotFilters {
  const normalizedLocation = typeof filters.location === 'string' ? filters.location.trim() : '';
  return {
    min_price: toFiniteNumber(filters.min_price),
    max_price: toFiniteNumber(filters.max_price),
    min_area: toFiniteNumber(filters.min_area),
    max_area: toFiniteNumber(filters.max_area),
    min_price_per_sotka: toFiniteNumber(filters.min_price_per_sotka),
    max_price_per_sotka: toFiniteNumber(filters.max_price_per_sotka),
    min_score: toFiniteNumber(filters.min_score),
    min_infra: toFiniteNumber(filters.min_infra),
    min_feature: toFiniteNumber(filters.min_feature),
    location: normalizedLocation || undefined,
  };
}

export function parseFilterNumber(searchParams: URLSearchParams, key: keyof PlotFilters): number | undefined {
  const raw = searchParams.get(key);
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function getFiltersFromSearchParams(searchParams: URLSearchParams): PlotFilters {
  const location = (searchParams.get('location') ?? '').trim();
  return {
    min_price: parseFilterNumber(searchParams, 'min_price'),
    max_price: parseFilterNumber(searchParams, 'max_price'),
    min_area: parseFilterNumber(searchParams, 'min_area'),
    max_area: parseFilterNumber(searchParams, 'max_area'),
    min_price_per_sotka: parseFilterNumber(searchParams, 'min_price_per_sotka'),
    max_price_per_sotka: parseFilterNumber(searchParams, 'max_price_per_sotka'),
    location: location || undefined,
  };
}
