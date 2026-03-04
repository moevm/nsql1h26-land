const API_BASE = '/api';

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
  distances: PlotDistances;
  infra_score: number;
  negative_score: number;
  total_score: number;
  created_at?: string;
  // search fields
  search_score?: number;
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
  const res = await fetch(`${API_BASE}/plots?${params}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchPlot(id: string): Promise<Plot> {
  const res = await fetch(`${API_BASE}/plots/${id}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function deletePlot(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/plots/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

export async function createPlot(data: Record<string, unknown>): Promise<Plot> {
  const res = await fetch(`${API_BASE}/plots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
}

export async function searchPlots(
  query: string,
  page = 1,
  pageSize = 20,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    page_size: String(pageSize),
  });
  const res = await fetch(`${API_BASE}/plots/search?${params}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
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

export async function fetchPlotsForMap(): Promise<{ items: MapPlot[]; total: number }> {
  const res = await fetch(`${API_BASE}/plots/map`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/* ---------- Data IO ---------- */

export async function exportAll(): Promise<Record<string, unknown[]>> {
  const res = await fetch(`${API_BASE}/data/export`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function importPlots(records: unknown[]): Promise<{ inserted: number }> {
  const res = await fetch(`${API_BASE}/data/import/plots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(records),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function getStats(): Promise<Record<string, number>> {
  const res = await fetch(`${API_BASE}/data/stats`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function clearCollection(collection: string): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/data/clear/${collection}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
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
