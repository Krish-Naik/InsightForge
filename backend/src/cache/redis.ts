// This cache module provides in-memory fallback caching
// Redis is handled by redisService.ts using ioredis

let redisReady = false;
let redisAttempted = false;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const isWindows = process.platform === 'win32';
const WSL_REDIS_URL = 'redis://172.27.196.32:6379';

export async function initRedis(): Promise<void> {
  if (redisAttempted) return;
  redisAttempted = true;
  
  const redisUrl = isWindows && !process.env.REDIS_URL ? WSL_REDIS_URL : REDIS_URL;
  
  try {
    console.log(`Redis: attempting connection to ${redisUrl}`);
    console.log('Redis unavailable, using in-memory fallback');
    redisReady = false;
  } catch {
    console.warn('Redis unavailable, using in-memory fallback');
    redisReady = false;
  }
}

export function isRedisReady(): boolean {
  return false;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memCache = new Map<string, CacheEntry<unknown>>();

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const entry = memCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memCache.delete(key);
      return null;
    }
    return entry.value as T;
  },

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlSeconds * 1000 };
    memCache.set(key, entry);
    if (memCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of memCache.entries()) {
        if (v.expiresAt < now) memCache.delete(k);
      }
    }
  },

  async del(key: string): Promise<void> {
    memCache.delete(key);
  },

  async invalidatePattern(pattern: string): Promise<void> {
    const patternStr = pattern.replace('*', '');
    for (const key of memCache.keys()) {
      if (key.includes(patternStr)) memCache.delete(key);
    }
  },
};

export const TTL = {
  PRICE: 60,
  CHART: 120,
  NEWS: 300,
  FUNDAMENTALS: 86400,
} as const;
