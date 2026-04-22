const API_BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(init?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail || `${res.status} ${res.statusText}`, res.status);
  }
  return res.json();
}

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  _id: string;
  username: string;
  role: UserRole;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export async function loginUser(username: string, password: string): Promise<AuthResult> {
  return fetchJson(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function registerUser(username: string, password: string): Promise<AuthResult> {
  return fetchJson(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe(): Promise<AuthUser> {
  return fetchJson(`${API_BASE}/auth/me`);
}

export interface PlotDistance {
  name: string;
  km: number;
}

export interface PlotDistances {
  nearest_metro: PlotDistance;
  nearest_hospital: PlotDistance;
  nearest_school: PlotDistance;
  nearest_kindergarten: PlotDistance;
  nearest_store: PlotDistance;
  nearest_pickup_point: PlotDistance;
  nearest_bus_stop: PlotDistance;
  nearest_negative: PlotDistance;
}

export interface Plot {
  _id: string;
  avito_id?: number;
  title: string;
  description: string;
  price: number;
  area_sotki?: number;
  price_per_sotka?: number;
  location: string;
  address: string;
  geo_ref: string;
  lat: number;
  lon: number;
  url: string;
  thumbnail: string;
  images_count: number;
  was_lowered: boolean;
  features: Record<string, number>;
  feature_score: number;
  features_text: string;
  distances?: PlotDistances;
  infra_score: number;
  negative_score: number;
  total_score: number;
  created_at?: string;
  updated_at?: string;
  owner_id?: string;
  owner_name?: string;
  combined_score?: number;
  jina_score?: number;
  price_history?: PriceHistoryPoint[];
}

export interface PriceHistoryPoint {
  price: number;
  at: string;
}

export interface PlotCreatePayload {
  title: string;
  description?: string;
  price: number;
  area_sotki?: number | null;
  location?: string;
  address?: string;
  geo_ref?: string;
  lat: number;
  lon: number;
  url?: string;
  thumbnail?: string;
  images_count?: number;
  was_lowered?: boolean;
}

export type PlotUpdatePayload = Partial<PlotCreatePayload>;

export interface PlotsListResponse {
  items: Plot[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  has_prev?: boolean;
  has_next?: boolean;
}

export interface PlotFilters {
  min_price?: number;
  max_price?: number;
  min_area?: number;
  max_area?: number;
  min_price_per_sotka?: number;
  max_price_per_sotka?: number;
  min_score?: number;
  min_infra?: number;
  min_feature?: number;
  location?: string;
}

const LIST_SORT_FIELDS = new Set([
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

const MY_SORT_FIELDS = new Set([
  'created_at',
  'price',
  'area_sotki',
  'total_score',
  'price_per_sotka',
  'infra_score',
  'feature_score',
]);

const ORDER_VALUES = new Set(['asc', 'desc']);

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function normalizeOrder(order?: string): 'asc' | 'desc' {
  return ORDER_VALUES.has(order ?? '') ? (order as 'asc' | 'desc') : 'desc';
}

function normalizeSort(sort: string | undefined, query: string): string {
  const hasQuery = query.trim().length > 0;
  const fallback = hasQuery ? 'relevance' : 'created_at';
  if (!sort || !LIST_SORT_FIELDS.has(sort)) return fallback;
  if (sort === 'relevance' && !hasQuery) return 'created_at';
  return sort;
}

function normalizeMySort(sort?: string): string {
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

export interface FetchPlotsParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
  filters?: PlotFilters;
  query?: string;
  signal?: AbortSignal;
}

export async function fetchPlots({
  page = 1,
  pageSize = 20,
  sort,
  order,
  filters = {},
  query = '',
  signal,
}: FetchPlotsParams = {}): Promise<PlotsListResponse> {
  const normalizedQuery = query.trim();
  const normalizedSort = normalizeSort(sort, normalizedQuery);
  const normalizedOrder = normalizeOrder(order);
  const normalizedFilters = sanitizePlotFilters(filters);

  const params = new URLSearchParams({
    page: String(toPositiveInt(page, 1)),
    page_size: String(toPositiveInt(pageSize, 20)),
    sort: normalizedSort,
    order: normalizedOrder,
  });

  for (const [k, v] of Object.entries(normalizedFilters)) {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, String(v));
    }
  }

  if (normalizedQuery) {
    params.set('q', normalizedQuery);
  }

  return fetchJson(`${API_BASE}/plots?${params}`, { signal });
}

export async function fetchPlot(id: string, signal?: AbortSignal): Promise<Plot> {
  return fetchJson(`${API_BASE}/plots/${id}`, { signal });
}

export async function fetchLocationSuggestions(
  query: string,
  { limit = 20, signal }: { limit?: number; signal?: AbortSignal } = {},
): Promise<string[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return fetchJson(`${API_BASE}/plots/locations/suggest?${params}`, { signal });
}

export async function deletePlot(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/plots/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `${res.status} ${res.statusText}`);
  }
}

export async function createPlot(data: PlotCreatePayload): Promise<Plot> {
  return fetchJson(`${API_BASE}/plots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updatePlot(id: string, data: PlotUpdatePayload): Promise<Plot> {
  return fetchJson(`${API_BASE}/plots/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchMyPlots(
  {
    page = 1,
    pageSize = 20,
    sort,
    order,
    signal,
  }: {
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: string;
    signal?: AbortSignal;
  } = {},
): Promise<PlotsListResponse> {
  const normalizedSort = normalizeMySort(sort);
  const normalizedOrder = normalizeOrder(order);

  const params = new URLSearchParams({
    page: String(toPositiveInt(page, 1)),
    page_size: String(toPositiveInt(pageSize, 20)),
    sort: normalizedSort,
    order: normalizedOrder,
  });

  return fetchJson(`${API_BASE}/plots/my?${params}`, { signal });
}

export interface MapPlot {
  _id: string;
  title: string;
  price: number;
  area_sotki?: number;
  lat: number;
  lon: number;
  total_score: number;
  location: string;
  features_text?: string;
}

export interface MapResponse {
  items: MapPlot[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface MapDataset {
  items: MapPlot[];
  total: number;
  pages: number;
  pageSize: number;
  loadedPages: number;
}

export interface LocationStats {
  location: string;
  sample_size: number;
  avg_price_per_sotka?: number;
  median_price_per_sotka?: number;
  avg_total_score?: number;
}

export interface SellerProfile {
  username: string;
  role: string;
  member_since?: string;
  plots_total: number;
  avg_total_score?: number;
  avg_price_per_sotka?: number;
}

async function fetchPlotsForMap(page = 1, pageSize = 200, signal?: AbortSignal): Promise<MapResponse> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  return fetchJson(`${API_BASE}/plots/map?${params}`, { signal });
}

export async function fetchAllPlotsForMap({
  pageSize = 2_000,
  concurrency = 8,
  signal,
  onProgress,
}: {
  pageSize?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (state: { loadedPages: number; totalPages: number; total: number }) => void;
} = {}): Promise<MapDataset> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const safeConcurrency = Math.max(1, Math.floor(concurrency));

  const firstPage = await fetchPlotsForMap(1, safePageSize, signal);
  const allItems = [...firstPage.items];
  const totalPages = Math.max(1, firstPage.pages);
  let loadedPages = 1;

  onProgress?.({
    loadedPages,
    totalPages,
    total: firstPage.total,
  });

  if (totalPages > 1) {
    const pageNumbers = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);

    for (let offset = 0; offset < pageNumbers.length; offset += safeConcurrency) {
      const chunk = pageNumbers.slice(offset, offset + safeConcurrency);
      const chunkResponses = await Promise.all(
        chunk.map((page) => fetchPlotsForMap(page, safePageSize, signal)),
      );

      for (const response of chunkResponses) {
        allItems.push(...response.items);
      }

      loadedPages += chunkResponses.length;
      onProgress?.({
        loadedPages,
        totalPages,
        total: firstPage.total,
      });
    }
  }

  return {
    items: allItems,
    total: firstPage.total,
    pages: totalPages,
    pageSize: safePageSize,
    loadedPages,
  };
}

export async function fetchLocationStats(location: string, signal?: AbortSignal): Promise<LocationStats> {
  const params = new URLSearchParams({ location });
  return fetchJson(`${API_BASE}/plots/stats/location?${params}`, { signal });
}

export async function fetchPriceHistory(plotId: string, signal?: AbortSignal): Promise<PriceHistoryPoint[]> {
  return fetchJson(`${API_BASE}/plots/${plotId}/price-history`, { signal });
}

export async function fetchSellerProfile(username: string, signal?: AbortSignal): Promise<SellerProfile> {
  return fetchJson(`${API_BASE}/users/${encodeURIComponent(username)}/profile`, { signal });
}

export async function exportAll(): Promise<Record<string, unknown[]>> {
  return fetchJson(`${API_BASE}/data/export`);
}

export async function importPlots(records: Array<Record<string, unknown>>): Promise<{ inserted: number }> {
  return fetchJson(`${API_BASE}/data/import/plots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(records),
  });
}

export async function getStats(): Promise<Record<string, number>> {
  return fetchJson(`${API_BASE}/data/stats`);
}

export async function clearCollection(collection: string): Promise<{ deleted: number; collection: string }> {
  return fetchJson(`${API_BASE}/data/clear/${collection}`, { method: 'DELETE' });
}

export async function importInfra(collection: string, records: Array<Record<string, unknown>>): Promise<{ replaced: number; collection: string }> {
  return fetchJson(`${API_BASE}/infra/${collection}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(records),
  });
}
