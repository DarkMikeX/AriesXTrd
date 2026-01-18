/**
 * Data Cache
 * Caches market data and indicators for performance optimization
 */

const Logger = require('../utils/Logger');

class DataCache {
  constructor() {
    this.logger = Logger.getInstance();
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes default TTL
    this.maxSize = 1000; // Maximum cache entries
    this.cleanupInterval = null;
  }

  /**
   * Initialize cache
   */
  initialize() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute

    this.logger.info('✅ Data cache initialized');
  }

  /**
   * Get cached data
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached data
   */
  set(key, data, ttl = this.ttl) {
    // Check cache size limit
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists and is valid
   */
  has(key) {
    const entry = this.cache.get(key);
    return entry && Date.now() <= entry.expiresAt;
  }

  /**
   * Delete cache entry
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  /**
   * Get or set (cache pattern)
   */
  async getOrSet(key, fetchFunction, ttl = this.ttl) {
    let data = this.get(key);

    if (data === null) {
      try {
        data = await fetchFunction();
        this.set(key, data, ttl);
      } catch (error) {
        this.logger.error('Cache fetch function error', { key, error: error.message });
        throw error;
      }
    }

    return data;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate(),
      expiredEntries: entries.filter(entry => now > entry.expiresAt).length,
      averageAge: entries.length > 0 ?
        entries.reduce((sum, entry) => sum + (now - entry.createdAt), 0) / entries.length / 1000 : 0,
      totalAccesses: entries.reduce((sum, entry) => sum + entry.accessCount, 0)
    };
  }

  /**
   * Calculate hit rate (simplified)
   */
  calculateHitRate() {
    // This would require tracking total requests vs cache hits
    // For now, return a placeholder
    return 0.85; // 85% hit rate
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug('Cache cleanup completed', { removed });
    }
  }

  /**
   * Evict oldest entries when cache is full
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug('Evicted oldest cache entry', { key: oldestKey });
    }
  }

  /**
   * Set TTL for cache
   */
  setTTL(ttl) {
    this.ttl = ttl;
  }

  /**
   * Set maximum cache size
   */
  setMaxSize(maxSize) {
    this.maxSize = maxSize;
  }

  /**
   * Get all cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry metadata
   */
  getMetadata(key) {
    const entry = this.cache.get(key);

    if (!entry) return null;

    return {
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      lastAccessed: entry.lastAccessed,
      accessCount: entry.accessCount,
      isExpired: Date.now() > entry.expiresAt,
      timeToLive: Math.max(0, entry.expiresAt - Date.now())
    };
  }

  /**
   * Warm up cache with common data
   */
  async warmup(commonKeys, fetchFunction) {
    this.logger.info('Starting cache warmup', { keys: commonKeys.length });

    for (const key of commonKeys) {
      try {
        await this.getOrSet(key, () => fetchFunction(key));
      } catch (error) {
        this.logger.error('Cache warmup error', { key, error: error.message });
      }
    }

    this.logger.info('Cache warmup completed');
  }

  /**
   * Export cache data
   */
  export() {
    const exportData = {};

    for (const [key, entry] of this.cache.entries()) {
      exportData[key] = {
        data: entry.data,
        metadata: {
          createdAt: entry.createdAt,
          expiresAt: entry.expiresAt,
          accessCount: entry.accessCount,
          lastAccessed: entry.lastAccessed
        }
      };
    }

    return exportData;
  }

  /**
   * Import cache data
   */
  import(cacheData) {
    let imported = 0;

    for (const [key, entry] of Object.entries(cacheData)) {
      if (this.cache.size < this.maxSize) {
        this.cache.set(key, {
          data: entry.data,
          createdAt: entry.metadata.createdAt,
          expiresAt: entry.metadata.expiresAt,
          accessCount: entry.metadata.accessCount || 0,
          lastAccessed: entry.metadata.lastAccessed || Date.now()
        });
        imported++;
      }
    }

    this.logger.info('Cache import completed', { imported });
    return imported;
  }

  /**
   * Destroy cache
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.clear();
    this.logger.info('✅ Data cache destroyed');
  }
}

module.exports = DataCache;