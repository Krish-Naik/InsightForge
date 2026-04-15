import { redisClient } from './redisService.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { Quote, Index, ScreenerMetric } from './marketTypes.js';

const STOCK_KEY_PREFIX = 'stock:quote';
const INDEX_KEY_PREFIX = 'stock:index';
const SCANNER_KEY_PREFIX = 'scanner:top';
const SCAN_RESULT_KEY_PREFIX = 'scanner:result';

export interface StockCacheData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  open: number;
  high52w: number;
  low52w: number;
  marketCap: number;
  marketState: string;
  exchange: string;
  timestamp: string;
}

export interface ScannerCacheData {
  type: 'movers' | 'volume' | 'breakout' | 'falling';
  stocks: ScreenerMetric[];
  generatedAt: string;
  expiresAt: string;
}

function getStockKey(symbol: string): string {
  return `${STOCK_KEY_PREFIX}:${symbol.toUpperCase()}`;
}

function getIndexKey(symbol: string): string {
  return `${INDEX_KEY_PREFIX}:${symbol.toUpperCase()}`;
}

function getScannerKey(type: string): string {
  return `${SCANNER_KEY_PREFIX}:${type}`;
}

async function getClient() {
  const client = redisClient.getClient();
  if (!client) {
    throw new Error('Redis not connected');
  }
  return client;
}

export async function setStockData(symbol: string, data: StockCacheData, ttl?: number): Promise<void> {
  try {
    const client = await getClient();
    const key = getStockKey(symbol);
    const expiry = ttl || config.redis.ttl;
    
    await client.setex(key, expiry, JSON.stringify(data));
    logger.debug(`Cached stock data for ${symbol}, TTL: ${expiry}s`);
  } catch (error) {
    logger.error(`Failed to cache stock data for ${symbol}: ${(error as Error).message}`);
  }
}

export async function getStockData(symbol: string): Promise<StockCacheData | null> {
  try {
    const client = await getClient();
    const key = getStockKey(symbol);
    
    const data = await client.get(key);
    if (!data) return null;
    
    return JSON.parse(data) as StockCacheData;
  } catch (error) {
    logger.error(`Failed to get stock data for ${symbol}: ${(error as Error).message}`);
    return null;
  }
}

export async function getMultipleStocks(symbols: string[]): Promise<Map<string, StockCacheData>> {
  const result = new Map<string, StockCacheData>();
  if (symbols.length === 0) return result;

  try {
    const client = await getClient();
    const keys = symbols.map(getStockKey);
    
    const pipeline = client.pipeline();
    for (const key of keys) {
      pipeline.get(key);
    }
    
    const responses = await pipeline.exec();
    if (!responses) return result;

    symbols.forEach((symbol, index) => {
      const [err, data] = responses[index];
      if (!err && data) {
        try {
          result.set(symbol, JSON.parse(data as string));
        } catch {
          logger.warn(`Failed to parse cached data for ${symbol}`);
        }
      }
    });
  } catch (error) {
    logger.error(`Failed to get multiple stocks: ${(error as Error).message}`);
  }

  return result;
}

export async function setIndexData(symbol: string, data: Index, ttl?: number): Promise<void> {
  try {
    const client = await getClient();
    const key = getIndexKey(symbol);
    const expiry = ttl || config.redis.ttl;
    
    await client.setex(key, expiry, JSON.stringify(data));
  } catch (error) {
    logger.error(`Failed to cache index data for ${symbol}: ${(error as Error).message}`);
  }
}

export async function getIndexData(symbol: string): Promise<Index | null> {
  try {
    const client = await getClient();
    const key = getIndexKey(symbol);
    
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Failed to get index data for ${symbol}: ${(error as Error).message}`);
    return null;
  }
}

export async function getMultipleIndices(symbols: string[]): Promise<Map<string, Index>> {
  const result = new Map<string, Index>();
  if (symbols.length === 0) return result;

  try {
    const client = await getClient();
    const keys = symbols.map(getIndexKey);
    
    const pipeline = client.pipeline();
    for (const key of keys) {
      pipeline.get(key);
    }
    
    const responses = await pipeline.exec();
    if (!responses) return result;

    symbols.forEach((symbol, index) => {
      const [err, data] = responses[index];
      if (!err && data) {
        try {
          result.set(symbol, JSON.parse(data as string));
        } catch {
          logger.warn(`Failed to parse cached index for ${symbol}`);
        }
      }
    });
  } catch (error) {
    logger.error(`Failed to get multiple indices: ${(error as Error).message}`);
  }

  return result;
}

export async function setScannerCache(type: string, data: ScannerCacheData): Promise<void> {
  try {
    const client = await getClient();
    const key = getScannerKey(type);
    const expiry = config.redis.scannerTtl;
    
    await client.setex(key, expiry, JSON.stringify(data));
    logger.debug(`Cached scanner data for ${type}, TTL: ${expiry}s`);
  } catch (error) {
    logger.error(`Failed to cache scanner data for ${type}: ${(error as Error).message}`);
  }
}

export async function getScannerCache(type: string): Promise<ScannerCacheData | null> {
  try {
    const client = await getClient();
    const key = getScannerKey(type);
    
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Failed to get scanner cache for ${type}: ${(error as Error).message}`);
    return null;
  }
}

export async function batchSetStocks(stocks: StockCacheData[], ttl?: number): Promise<number> {
  let successCount = 0;
  const expiry = ttl || config.redis.ttl;

  try {
    const client = await getClient();
    
    const pipeline = client.pipeline();
    for (const stock of stocks) {
      const key = getStockKey(stock.symbol);
      pipeline.setex(key, expiry, JSON.stringify(stock));
    }
    
    const responses = await pipeline.exec();
    if (responses) {
      successCount = responses.filter(([err]: [Error | null, unknown]) => !err).length;
    }
    
    logger.info(`Batch cached ${successCount}/${stocks.length} stocks`);
  } catch (error) {
    logger.error(`Batch stock cache failed: ${(error as Error).message}`);
  }

  return successCount;
}

export async function batchSetIndices(indices: Index[], ttl?: number): Promise<number> {
  let successCount = 0;
  const expiry = ttl || config.redis.ttl;

  try {
    const client = await getClient();
    
    const pipeline = client.pipeline();
    for (const index of indices) {
      const key = getIndexKey(index.symbol);
      pipeline.setex(key, expiry, JSON.stringify(index));
    }
    
    const responses = await pipeline.exec();
    if (responses) {
      successCount = responses.filter(([err]: [Error | null, unknown]) => !err).length;
    }
  } catch (error) {
    logger.error(`Batch index cache failed: ${(error as Error).message}`);
  }

  return successCount;
}

export async function invalidateStock(symbol: string): Promise<void> {
  try {
    const client = await getClient();
    await client.del(getStockKey(symbol));
  } catch (error) {
    logger.error(`Failed to invalidate stock ${symbol}: ${(error as Error).message}`);
  }
}

export async function invalidateScanner(type: string): Promise<void> {
  try {
    const client = await getClient();
    await client.del(getScannerKey(type));
  } catch (error) {
    logger.error(`Failed to invalidate scanner ${type}: ${(error as Error).message}`);
  }
}

export async function getCacheStats(): Promise<{ keys: number; memory: string }> {
  try {
    const client = await getClient();
    const [keys, info] = await Promise.all([
      client.dbsize(),
      client.info('memory'),
    ]);
    
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const memory = memoryMatch ? memoryMatch[1] : 'unknown';
    
    return { keys, memory };
  } catch (error) {
    logger.error(`Failed to get cache stats: ${(error as Error).message}`);
    return { keys: 0, memory: 'unknown' };
  }
}
