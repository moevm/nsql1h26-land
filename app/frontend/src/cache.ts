/**
 * Простой in-memory кэш для API-запросов.
 * TTL задаётся при чтении; запись — без TTL.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Получить закэшированное значение (null если нет или TTL истёк). */
export function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

/** Положить значение в кэш. */
export function setCache(key: string, data: unknown): void {
  store.set(key, { data, timestamp: Date.now() });
}

/** Инвалидировать кэш по префиксу (или весь). */
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
