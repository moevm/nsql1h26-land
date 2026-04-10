import type { Query } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const QUERY_PERSIST_KEY = 'land-plots-query-cache-v1';
const QUERY_PERSIST_MAX_AGE_MS = 45 * 60_000;
const PLOT_QUERY_SCOPES = new Set([
  'list',
  'detail',
  'my',
  'price-history',
  'location-stats',
]);

function shouldPersistQuery(query: Query): boolean {
  const [root, scope] = query.queryKey;
  if (root !== 'plots') {
    return false;
  }

  if (typeof scope !== 'string') {
    return true;
  }

  return PLOT_QUERY_SCOPES.has(scope);
}

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: QUERY_PERSIST_KEY,
  throttleTime: 1_000,
});

export const queryPersistOptions = {
  persister,
  maxAge: QUERY_PERSIST_MAX_AGE_MS,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
  },
};
