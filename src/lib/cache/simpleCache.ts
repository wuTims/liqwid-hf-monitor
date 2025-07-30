/**
 * Simple, generic in-memory cache service.
 *
 * This utility is kept deliberately small because it will eventually be
 * replaced by a proper KV or Redis implementation when the worker is
 * deployed to production.  Until then it provides a predictable API that
 * can be mocked easily in tests.
 *
 * The cache stores the data together with its expiry timestamp.  A value is
 * considered expired the millisecond the current time exceeds the stored
 * timestamp.
 */
export class SimpleCache<T> {
  private readonly cache = new Map<string, { data: T; expiresAt: number }>();

  /**
   * Retrieve a cached entry if it exists **and** is still valid.
   * @param key Unique cache key
   * @returns Cached item or `undefined` when not present / expired.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      // Expired – clean up eagerly so the map does not grow unbounded
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * Store a new value in the cache.
   * @param key        Unique cache key
   * @param data       Data to store
   * @param ttlSeconds Time-to-live, in seconds
   */
  set(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Return the expiry timestamp of an existing entry – useful for debugging
   * and metrics.
   */
  getExpiry(key: string): number | undefined {
    return this.cache.get(key)?.expiresAt;
  }
}
