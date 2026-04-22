import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.client && this.isConnected) return;

    try {
      this.client = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            logger.warn('Redis retry limit reached, giving up');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      await this.client.connect();
      this.isConnected = true;
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error(`Redis connection failed: ${(error as Error).message}`);
      this.isConnected = false;
      this.client = null;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  healthCheck(): { connected: boolean; latencyMs?: number } {
    if (!this.isConnected || !this.client) {
      return { connected: false };
    }
    const start = Date.now();
    this.client.ping().then(() => {
      const latency = Date.now() - start;
      logger.debug(`Redis ping: ${latency}ms`);
    }).catch(() => {
      this.isConnected = false;
    });
    return { connected: this.isConnected };
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.warn(`Redis get error: ${(error as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.warn(`Redis set error: ${(error as Error).message}`);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.warn(`Redis del error: ${(error as Error).message}`);
      return false;
    }
  }
}

export const redisClient = new RedisClient();

export async function initRedis(): Promise<void> {
  await redisClient.connect();
}
