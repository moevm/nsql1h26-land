import { del, get, set } from 'idb-keyval';

import type { MapDataset } from '../api';

const MAP_CACHE_KEY = 'land-plots-map-dataset-v2';
const MAP_CACHE_TTL_MS = 30 * 60_000;

type MapCachePayload = {
  savedAt: number;
  data: MapDataset;
};

export async function readMapCache(maxAgeMs = MAP_CACHE_TTL_MS): Promise<MapDataset | null> {
  const payload = await get<MapCachePayload>(MAP_CACHE_KEY);
  if (!payload) {
    return null;
  }

  if (Date.now() - payload.savedAt > maxAgeMs) {
    await del(MAP_CACHE_KEY);
    return null;
  }

  return payload.data;
}

export async function writeMapCache(data: MapDataset): Promise<void> {
  await set(MAP_CACHE_KEY, {
    savedAt: Date.now(),
    data,
  } satisfies MapCachePayload);
}

export async function clearMapCache(): Promise<void> {
  await del(MAP_CACHE_KEY);
}
