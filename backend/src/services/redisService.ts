import { Redis } from '@upstash/redis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.client && this.isConnected) return;

    try {
      this.client = new Redis({
        url: config.redis.url,
        token: this.extractToken(config.redis.url),
      });

      await this.client.ping();
      this.isConnected = true;
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error(`Redis connection failed: ${(error as Error).message}`);
      this.isConnected = false;
      this.client = null;
    }
  }

  private extractToken(url: string): string {
    try {
      const match = url.match(/redis:\/\/([^:]+):([^@]+)@/);
      if (match) return match[2];
      return url;
    } catch {
      return url;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.isConnected = false;
    logger.info('Redis disconnected');
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
        await this.client.set(key, value, { EX: ttlSeconds });
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
