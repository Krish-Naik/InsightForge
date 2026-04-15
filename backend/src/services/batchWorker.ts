import { YahooFinanceService } from './yahooFinanceService.js';
import { 
  setStockData, 
  setIndexData, 
  batchSetStocks, 
  batchSetIndices,
  setScannerCache,
  getScannerCache,
  type StockCacheData 
} from './stockCacheService.js';
import { MarketUniverseService } from './marketUniverseService.js';
import { logger } from '../utils/logger.js';
import type { Index, ScreenerMetric, Quote } from './marketTypes.js';

const BATCH_SIZE = 50;
const SCANNER_TYPES = ['movers', 'volume', 'breakout', 'falling'] as const;

export interface BatchJobResult {
  success: boolean;
  stocksProcessed: number;
  indicesProcessed: number;
  scannerProcessed: number;
  errors: string[];
  timestamp: string;
}

function quoteToCacheData(quote: Quote): StockCacheData {
  return {
    symbol: quote.symbol,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    volume: quote.volume,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    previousClose: quote.previousClose,
    open: quote.open,
    high52w: quote.high52w,
    low52w: quote.low52w,
    marketCap: quote.marketCap,
    marketState: quote.marketState,
    exchange: quote.exchange,
    timestamp: quote.timestamp,
  };
}

async function fetchAndCacheIndices(indices: string[]): Promise<number> {
  if (!indices.length) return 0;
  
  const cached: Index[] = [];
  
  for (const symbol of indices) {
    try {
      const data = await YahooFinanceService.getIndex(symbol);
      if (data) {
        cached.push(data);
      }
    } catch {
      // Silently skip failed indices
    }
  }
  
  if (cached.length > 0) {
    await batchSetIndices(cached);
  }
  
  return cached.length;
}

async function fetchAndCacheStocks(symbols: string[]): Promise<number> {
  if (!symbols.length) return 0;
  
  const cached: StockCacheData[] = [];
  
  for (const symbol of symbols) {
    try {
      const quote = await YahooFinanceService.getQuote(symbol);
      if (quote && quote.price > 0) {
        cached.push(quoteToCacheData(quote));
      }
    } catch {
      // Silently skip failed symbols - 404s are expected for invalid symbols
    }
  }
  
  if (cached.length > 0) {
    await batchSetStocks(cached);
  }
  
  return cached.length;
}

export async function runBatchJob(): Promise<BatchJobResult> {
  const errors: string[] = [];
  let stocksProcessed = 0;
  let indicesProcessed = 0;
  let scannerProcessed = 0;
  
  logger.info('Starting market data batch job');
  const startTime = Date.now();
  
  try {
    const indices = MarketUniverseService.getIndexSymbols();
    indicesProcessed = await fetchAndCacheIndices(indices);
    logger.info(`Processed ${indicesProcessed} indices`);
  } catch (error) {
    errors.push(`Indices batch failed: ${(error as Error).message}`);
  }
  
  try {
    const stockSymbols = MarketUniverseService.getStockSymbols();
    const batches = chunkArray(stockSymbols, BATCH_SIZE);
    
    for (const batch of batches) {
      const count = await fetchAndCacheStocks(batch);
      stocksProcessed += count;
    }
    
    logger.info(`Processed ${stocksProcessed} stocks in ${batches.length} batches`);
  } catch (error) {
    errors.push(`Stocks batch failed: ${(error as Error).message}`);
  }
  
  try {
    scannerProcessed = 0; // await computeAndCacheScanners();
    logger.info(`Processed ${scannerProcessed} scanners`);
  } catch (error) {
    errors.push(`Scanner computation failed: ${(error as Error).message}`);
  }
  
  const duration = Date.now() - startTime;
  logger.info(`Batch job completed in ${duration}ms - stocks: ${stocksProcessed}, indices: ${indicesProcessed}, scanners: ${scannerProcessed}`);
  
  return {
    success: errors.length === 0,
    stocksProcessed,
    indicesProcessed,
    scannerProcessed,
    errors,
    timestamp: new Date().toISOString(),
  };
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

let batchInterval: NodeJS.Timeout | null = null;

export function startBatchWorker(intervalMs = 60_000): void {
  if (batchInterval) {
    logger.warn('Batch worker already running');
    return;
  }
  
  logger.info(`Starting batch worker with interval ${intervalMs}ms`);
  
  void runBatchJob();
  
  batchInterval = setInterval(() => {
    void runBatchJob();
  }, intervalMs);
}

export function stopBatchWorker(): void {
  if (batchInterval) {
    clearInterval(batchInterval);
    batchInterval = null;
    logger.info('Batch worker stopped');
  }
}
