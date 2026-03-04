import NodeCache from 'node-cache';

const shortCache  = new NodeCache({ stdTTL: 60,    checkperiod: 120   }); // 1 minute
const mediumCache = new NodeCache({ stdTTL: 300,   checkperiod: 600   }); // 5 minutes
const longCache   = new NodeCache({ stdTTL: 3600,  checkperiod: 7200  }); // 1 hour
const dailyCache  = new NodeCache({ stdTTL: 86400, checkperiod: 43200 }); // 24 hours

type CacheTier = 'short' | 'medium' | 'long' | 'daily';

function getStore(tier: CacheTier): NodeCache {
  switch (tier) {
    case 'short':  return shortCache;
    case 'medium': return mediumCache;
    case 'long':   return longCache;
    case 'daily':  return dailyCache;
  }
}

export async function cached<T>(
  key: string,
  tier: CacheTier,
  fetchFn: () => Promise<T>
): Promise<T> {
  const store = getStore(tier);
  const existing = store.get<T>(key);
  if (existing !== undefined) {
    return existing;
  }
  const result = await fetchFn();
  store.set(key, result);
  return result;
}

export function setCache(key: string, value: any, tier: CacheTier): void {
  getStore(tier).set(key, value);
}

export function getCache<T>(key: string, tier: CacheTier): T | undefined {
  return getStore(tier).get<T>(key);
}

export function invalidateCache(key: string, tier: CacheTier): void {
  getStore(tier).del(key);
}

export function invalidateCacheByPrefix(prefix: string, tier: CacheTier): void {
  const store = getStore(tier);
  const keys = store.keys().filter(k => k.startsWith(prefix));
  keys.forEach(k => store.del(k));
}

export function clearAllCache(): void {
  shortCache.flushAll();
  mediumCache.flushAll();
  longCache.flushAll();
  dailyCache.flushAll();
}

export function getCacheStats() {
  const build = (store: NodeCache, ttl: number) => ({
    ttl,
    keyCount: store.keys().length,
    ...store.getStats(),
  });
  return {
    short:  build(shortCache,  60),
    medium: build(mediumCache, 300),
    long:   build(longCache,   3600),
    daily:  build(dailyCache,  86400),
    totalKeys:
      shortCache.keys().length +
      mediumCache.keys().length +
      longCache.keys().length +
      dailyCache.keys().length,
  };
}
