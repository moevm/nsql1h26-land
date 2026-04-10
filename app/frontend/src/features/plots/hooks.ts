import { useEffect, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  createPlot,
  deletePlot,
  fetchAllPlotsForMap,
  fetchLocationStats,
  fetchMyPlots,
  fetchPlot,
  fetchPlots,
  fetchPriceHistory,
  fetchSellerProfile,
  sanitizePlotFilters,
  updatePlot,
  type MapDataset,
  type Plot,
  type PlotCreatePayload,
  type PlotFilters,
  type PlotUpdatePayload,
} from '../../api';
import { clearMapCache, readMapCache, writeMapCache } from '../../lib/mapCache';
import { plotsQueryKeys } from './queryKeys';

type ListParams = {
  page: number;
  pageSize: number;
  sort: string;
  order: string;
  query: string;
  filters: PlotFilters;
};

type MapProgress = {
  loadedPages: number;
  totalPages: number;
  total: number;
  fromCache: boolean;
};

const MAP_PAGE_SIZE = 2_000;
const MAP_FETCH_CONCURRENCY = 8;
const MAP_STALE_TIME_MS = 10 * 60_000;
const MAP_GC_TIME_MS = 60 * 60_000;

const EMPTY_MAP_PROGRESS: MapProgress = {
  loadedPages: 0,
  totalPages: 0,
  total: 0,
  fromCache: false,
};

function toCompletedMapProgress(data: MapDataset, fromCache: boolean): MapProgress {
  return {
    loadedPages: data.loadedPages,
    totalPages: data.pages,
    total: data.total,
    fromCache,
  };
}

const stableFilters = (filters: PlotFilters): string => {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
};

export function usePlotsListQuery(params: ListParams) {
  const normalizedFilters = sanitizePlotFilters(params.filters);
  const normalizedQuery = params.query.trim();
  const filtersHash = stableFilters(normalizedFilters);

  return useQuery({
    queryKey: plotsQueryKeys.list({
      page: params.page,
      pageSize: params.pageSize,
      sort: params.sort,
      order: params.order,
      query: normalizedQuery,
      filtersHash,
    }),
    queryFn: ({ signal }) =>
      fetchPlots({
        page: params.page,
        pageSize: params.pageSize,
        sort: params.sort,
        order: params.order,
        filters: normalizedFilters,
        query: normalizedQuery,
        signal,
      }),
    placeholderData: (prev) => prev,
  });
}

export function usePlotQuery(id: string) {
  return useQuery({
    queryKey: plotsQueryKeys.detail(id),
    queryFn: ({ signal }) => fetchPlot(id, signal),
    enabled: Boolean(id),
  });
}

export function useMyPlotsQuery(params: {
  page: number;
  pageSize: number;
  sort: string;
  order: string;
}) {
  return useQuery({
    queryKey: plotsQueryKeys.my(params),
    queryFn: ({ signal }) =>
      fetchMyPlots({
        page: params.page,
        pageSize: params.pageSize,
        sort: params.sort,
        order: params.order,
        signal,
      }),
    placeholderData: (prev) => prev,
  });
}

export function useMapPlotsQuery({
  pageSize = MAP_PAGE_SIZE,
  concurrency = MAP_FETCH_CONCURRENCY,
}: {
  pageSize?: number;
  concurrency?: number;
} = {}) {
  const [progress, setProgress] = useState<MapProgress>(EMPTY_MAP_PROGRESS);

  const query = useQuery({
    queryKey: plotsQueryKeys.map({ pageSize, concurrency }),
    queryFn: async ({ signal }) => {
      const cached = await readMapCache();
      if (cached) {
        setProgress(toCompletedMapProgress(cached, true));
        return cached;
      }

      setProgress(EMPTY_MAP_PROGRESS);
      const dataset = await fetchAllPlotsForMap({
        pageSize,
        concurrency,
        signal,
        onProgress: ({ loadedPages, totalPages, total }) => {
          setProgress({
            loadedPages,
            totalPages,
            total,
            fromCache: false,
          });
        },
      });

      void writeMapCache(dataset);
      return dataset;
    },
    staleTime: MAP_STALE_TIME_MS,
    gcTime: MAP_GC_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    setProgress((prev) => {
      const next = toCompletedMapProgress(query.data, prev.fromCache);
      if (
        prev.loadedPages === next.loadedPages
        && prev.totalPages === next.totalPages
        && prev.total === next.total
        && prev.fromCache === next.fromCache
      ) {
        return prev;
      }

      return next;
    });
  }, [query.data]);

  return {
    ...query,
    progress,
  };
}

export function usePriceHistoryQuery(plotId: string) {
  return useQuery({
    queryKey: ['plots', 'price-history', plotId],
    queryFn: ({ signal }) => fetchPriceHistory(plotId, signal),
    enabled: Boolean(plotId),
  });
}

export function useLocationStatsQuery(location?: string) {
  return useQuery({
    queryKey: ['plots', 'location-stats', location ?? ''],
    queryFn: ({ signal }) => fetchLocationStats(location ?? '', signal),
    enabled: Boolean(location && location.trim().length >= 2),
  });
}

export function useSellerProfileQuery(username?: string) {
  return useQuery({
    queryKey: ['users', 'seller-profile', username ?? ''],
    queryFn: ({ signal }) => fetchSellerProfile(username ?? '', signal),
    enabled: Boolean(username && username.trim().length >= 3),
  });
}

export function useCreatePlotMutation(
  options?: UseMutationOptions<Plot, Error, PlotCreatePayload>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createPlot(payload),
    onSuccess: async (...args) => {
      await clearMapCache();
      await queryClient.invalidateQueries({ queryKey: plotsQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: plotsQueryKeys.mapAll });
      if (options?.onSuccess) {
        await options.onSuccess(...args);
      }
    },
    ...options,
  });
}

export function useUpdatePlotMutation(
  id: string,
  options?: UseMutationOptions<Plot, Error, PlotUpdatePayload>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => updatePlot(id, payload),
    onSuccess: async (...args) => {
      await clearMapCache();
      await queryClient.invalidateQueries({ queryKey: plotsQueryKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: plotsQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: plotsQueryKeys.mapAll });
      if (options?.onSuccess) {
        await options.onSuccess(...args);
      }
    },
    ...options,
  });
}

export function useDeletePlotMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deletePlot(id),
    onSuccess: async (...args) => {
      await clearMapCache();
      await queryClient.invalidateQueries({ queryKey: plotsQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: plotsQueryKeys.mapAll });
      if (options?.onSuccess) {
        await options.onSuccess(...args);
      }
    },
    ...options,
  });
}

export function usePrefetchPlotDetail() {
  const queryClient = useQueryClient();

  return (id: string) => {
    if (!id) {
      return Promise.resolve();
    }

    return queryClient.prefetchQuery({
      queryKey: plotsQueryKeys.detail(id),
      queryFn: ({ signal }) => fetchPlot(id, signal),
    });
  };
}

export function usePrefetchPlotsListPage(params: Omit<ListParams, 'page'>) {
  const queryClient = useQueryClient();

  return (page: number) => {
    const normalizedFilters = sanitizePlotFilters(params.filters);
    const normalizedQuery = params.query.trim();
    const filtersHash = stableFilters(normalizedFilters);

    return queryClient.prefetchQuery({
      queryKey: plotsQueryKeys.list({
        page,
        pageSize: params.pageSize,
        sort: params.sort,
        order: params.order,
        query: normalizedQuery,
        filtersHash,
      }),
      queryFn: ({ signal }) =>
        fetchPlots({
          page,
          pageSize: params.pageSize,
          sort: params.sort,
          order: params.order,
          filters: normalizedFilters,
          query: normalizedQuery,
          signal,
        }),
    });
  };
}
