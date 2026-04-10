const PLOTS_ROOT = ['plots'] as const;

export const plotsQueryKeys = {
  all: PLOTS_ROOT,
  list: (params: {
    page: number;
    pageSize: number;
    sort: string;
    order: string;
    query: string;
    filtersHash: string;
  }) => [...PLOTS_ROOT, 'list', params] as const,
  detail: (id: string) => [...PLOTS_ROOT, 'detail', id] as const,
  my: (params: { page: number; pageSize: number; sort: string; order: string }) =>
    [...PLOTS_ROOT, 'my', params] as const,
  mapAll: [...PLOTS_ROOT, 'map'] as const,
  map: (params: { pageSize: number; concurrency: number }) => [...PLOTS_ROOT, 'map', params] as const,
};
