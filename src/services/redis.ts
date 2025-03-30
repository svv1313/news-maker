import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL as string;

if (!redisUrl) {
    throw new Error('REDIS_URL is not defined in environment variables.');
}

const redis = new Redis(redisUrl);

const CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds


type CachedData = any;

/**
 * Retrieves data from the Redis cache.
 * @param key - The key to retrieve from the cache.
 * @returns The parsed data or null if not found or error occurs.
 */
export async function getCachedData(key: string): Promise<CachedData | null> {
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
}

/**
 * Sets data in the Redis cache with a specified TTL (time-to-live).
 * @param key - The key to set in the cache.
 * @param data - The data to store.
 * @param ttl - The TTL for the cache in seconds (default is 24 hours).
 * @returns True if successful, otherwise false.
 */
export async function setCachedData(key: string, data: CachedData, ttl: number = CACHE_TTL): Promise<boolean> {
    try {
        await redis.set(key, JSON.stringify(data), 'EX', ttl);
        return true;
    } catch (error) {
        console.error('Redis set error:', error);
        return false;
    }
}

/**
 * Deletes data from the Redis cache.
 * @param key - The key to delete from the cache.
 * @returns True if successful, otherwise false.
 */
export async function deleteCachedData(key: string): Promise<boolean> {
    try {
        await redis.del(key);
        return true;
    } catch (error) {
        console.error('Redis delete error:', error);
        return false;
    }
}