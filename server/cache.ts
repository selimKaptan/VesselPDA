interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  insertedAt: number;
}

class SimpleCache {
  private store = new Map<string, CacheEntry<any>>();
  private hits = 0;
  private misses = 0;
  private readonly MAX_ENTRIES = 1000;

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.store.size >= this.MAX_ENTRIES && !this.store.has(key)) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [k, v] of this.store) {
        if (v.insertedAt < oldestTime) {
          oldestTime = v.insertedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) this.store.delete(oldestKey);
    }
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000,
      insertedAt: now,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  stats() {
    const now = Date.now();
    let expired = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        expired++;
      }
    }
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      total,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : "N/A",
      expiredEvicted: expired,
      maxEntries: this.MAX_ENTRIES,
    };
  }

  clear(): void {
    const size = this.store.size;
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    return size as any;
  }
}

export const cache = new SimpleCache();
