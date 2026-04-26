import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;
  private initPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.doConnect();
    await this.initPromise;
  }

  private async doConnect(): Promise<void> {
    if (this.client && this.isConnected) return;

    try {
      const redisUrl = config.redis.url;
      
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times: number) => {
          if (times > 1) {
            logger.warn('Redis retry limit reached, giving up');
            return null;
          }
          return Math.min(times * 500, 5000);
        },
        connectTimeout: 15000,
        commandTimeout: 10000,
        enableReadyCheck: false,
        lazyConnect: false,
        family: 4,
      });

      this.client.on('error', (err) => {
        logger.error(`Redis error: ${err.message}`);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      await this.client.ping();
      this.isConnected = true;
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.warn(`Redis connection failed: ${(error as Error).message} - continuing without cache`);
      this.isConnected = false;
      this.client = null;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore
      }
      this.client = null;
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  healthCheck(): { connected: boolean; latencyMs?: number } {
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