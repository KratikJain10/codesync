import Redis from 'ioredis';

// Redis client singleton — used for caching, sessions, and pub/sub.
// Falls back gracefully when REDIS_URL is not set (dev mode).

const REDIS_URL = process.env.REDIS_URL || '';

let redis: Redis | null = null;

if (REDIS_URL) {
    redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    redis.on('error', (err) => console.error('Redis error:', err.message));
    redis.on('connect', () => console.log('📦 Redis connected'));
}

export { redis };

// ─── Cache Helpers ───────────────────────────────────────────────────────
// Simple get/set with TTL. No-ops when Redis is unavailable.

export async function cacheGet<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
        const val = await redis.get(key);
        return val ? JSON.parse(val) : null;
    } catch {
        return null;
    }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    if (!redis) return;
    try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch { /* ignore */ }
}

export async function cacheDel(key: string): Promise<void> {
    if (!redis) return;
    try {
        await redis.del(key);
    } catch { /* ignore */ }
}
