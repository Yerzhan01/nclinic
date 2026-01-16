import { Redis } from 'ioredis';
import { env } from './env.js';

const globalForRedis = globalThis as unknown as {
    redis: Redis | undefined;
};

function createRedisClient(): Redis {
    const client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        retryStrategy(times: number) {
            if (times > 10) {
                console.error('❌ Redis: Max retries exceeded');
                return null;
            }
            const delay = Math.min(times * 100, 3000);
            console.log(`🔄 Redis: Retrying connection in ${delay}ms...`);
            return delay;
        },
    });

    client.on('connect', () => {
        console.log('✅ Redis connected');
    });

    client.on('error', (error: Error) => {
        console.error('❌ Redis error:', error.message);
    });

    client.on('close', () => {
        console.log('📤 Redis connection closed');
    });

    return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (env.NODE_ENV === 'development') {
    globalForRedis.redis = redis;
}

export async function connectRedis(): Promise<void> {
    if (redis.status === 'ready') {
        return;
    }

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Redis connection timeout'));
        }, 10000);

        redis.once('ready', () => {
            clearTimeout(timeout);
            resolve();
        });

        redis.once('error', (error: Error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

export async function disconnectRedis(): Promise<void> {
    await redis.quit();
}
