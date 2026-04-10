const API_BASE = '/api';

/* ---------- Auth helpers ---------- */

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ---------- Fetch helper ---------- */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(init?.headers as Record<string, string> || {}),
  };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

/* ---------- Auth ---------- */

export interface AuthResult {
  token: string;
  user: { _id: string; username: string; role: string };
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

export async function getMe(): Promise<{ _id: string; username: string; role: string }> {
  return fetchJson(`${API_BASE}/auth/me`);
}

/* ---------- Plots ---------- */

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
  // search fields
  combined_score?: number;
  jina_score?: number;
}

export interface PlotsListResponse {
  items: Plot[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SearchResponse {
  items: Plot[];
  total: number;
  query: string;
  page: number;
  page_size: number;
  pages: number;
  can_expand: boolean;
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

export async function fetchPlots(
  page = 1,
  pageSize = 20,
  sort = 'created_at',
  order = 'desc',
  filters: PlotFilters = {},
  query = '',
  signal?: AbortSignal,
): Promise<PlotsListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort,
    order,
  });
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, String(v));
    }
  }
  if (query.trim()) {
    params.set('q', query.trim());
  }
  return fetchJson(`${API_BASE}/plots?${params}`, { signal });
}

export async function fetchPlot(id: string, signal?: AbortSignal): Promise<Plot> {
  return fetchJson(`${API_BASE}/plots/${id}`, { signal });
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

export async function createPlot(data: Record<string, unknown>): Promise<Plot> {
  return fetchJson(`${API_BASE}/plots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updatePlot(id: string, data: Record<string, unknown>): Promise<Plot> {
  return fetchJson(`${API_BASE}/plots/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function searchPlots(
  query: string,
  page = 1,
  pageSize = 20,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    page_size: String(pageSize),
  });
  return fetchJson(`${API_BASE}/plots/search?${params}`, { signal });
}

export async function fetchMyPlots(
  page = 1,
  pageSize = 20,
  sort = 'created_at',
  order = 'desc',
  signal?: AbortSignal,
): Promise<PlotsListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort,
    order,
  });
  return fetchJson(`${API_BASE}/plots/my?${params}`, { signal });
}

/* ---------- Map ---------- */

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

export async function fetchPlotsForMap(page = 1, pageSize = 200, signal?: AbortSignal): Promise<MapResponse> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  return fetchJson(`${API_BASE}/plots/map?${params}`, { signal });
}

/* ---------- Data IO ---------- */

export async function exportAll(): Promise<Record<string, unknown[]>> {
  return fetchJson(`${API_BASE}/data/export`);
}

export async function importPlots(records: unknown[]): Promise<{ inserted: number }> {
  return fetchJson(`${API_BASE}/data/import/plots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(records),
  });
}

export async function getStats(): Promise<Record<string, number>> {
  return fetchJson(`${API_BASE}/data/stats`);
}

export async function clearCollection(collection: string): Promise<{ deleted: number }> {
  return fetchJson(`${API_BASE}/data/clear/${collection}`, { method: 'DELETE' });
}

export async function importInfra(collection: string, records: unknown[]): Promise<{ inserted: number; collection: string }> {
  return fetchJson(`${API_BASE}/data/import/infra/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(records),
  });
}

/* ---------- Infrastructure ---------- */

export async function fetchInfraCollections(): Promise<{ collections: string[] }> {
  const res = await fetch(`${API_BASE}/infra/collections`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function fetchInfraObjects(collection: string): Promise<unknown[]> {
  const res = await fetch(`${API_BASE}/infra/${collection}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
