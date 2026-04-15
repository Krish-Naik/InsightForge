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

const BATCH_SIZE = 100;
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
  
  try {
    const quotes = await YahooFinanceService.getQuotes(indices);
    const validIndices = quotes
      .filter(q => q.price > 0)
      .map(q => ({
        symbol: q.symbol,
        shortName: q.name,
        rawSymbol: q.symbol,
        exchange: q.exchange,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        volume: q.volume,
        previousClose: q.previousClose,
        dayHigh: q.dayHigh,
        dayLow: q.dayLow,
        marketState: q.marketState,
        timestamp: q.timestamp,
        isStale: q.isStale,
      } as Index));
    
    if (validIndices.length > 0) {
      await batchSetIndices(validIndices);
    }
    
    return validIndices.length;
  } catch (error) {
    logger.warn(`Indices batch failed: ${(error as Error).message}`);
    return 0;
  }
}

async function fetchAndCacheStocks(symbols: string[]): Promise<number> {
  if (!symbols.length) return 0;
  
  try {
    const quotes = await YahooFinanceService.getQuotes(symbols);
    
    const validQuotes = quotes.filter(q => q.price > 0 && q.symbol);
    
    const cacheData: StockCacheData[] = validQuotes.map(quoteToCacheData);
    
    if (cacheData.length > 0) {
      await batchSetStocks(cacheData);
    }
    
    return cacheData.length;
  } catch (error) {
    logger.error(`Stocks batch fetch failed: ${(error as Error).message}`);
    return 0;
  }
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
    let stockSymbols = MarketUniverseService.getStockSymbols();
    
    if (!stockSymbols.length) {
      logger.warn('No stock symbols from universe, using fallback');
      stockSymbols = NIFTY_FULL_LIST;
    }
    
    const batches = chunkArray(stockSymbols, BATCH_SIZE);
    let totalBatches = batches.length;
    let processedBatches = 0;
    
    for (const batch of batches) {
      const count = await fetchAndCacheStocks(batch);
      stocksProcessed += count;
      processedBatches++;
      
      if (processedBatches % 10 === 0 || processedBatches === totalBatches) {
        logger.info(`Stock progress: ${processedBatches}/${totalBatches} batches, ${stocksProcessed} cached`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    logger.info(`Processed ${stocksProcessed} stocks in ${batches.length} batches`);
  } catch (error) {
    errors.push(`Stocks batch failed: ${(error as Error).message}`);
  }
  
  try {
    scannerProcessed = 0;
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

const NIFTY_FULL_LIST = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'SBIN', 'BHARTIARTL', 'ITC', 'LTCG', 'HINDUNILVR',
  'TITAN', 'BAJFINANCE', 'SUNPHARMA', 'ULTRACEMCO', 'MARUTI', 'TATASTEEL', 'POWERGRID', 'NTPC', 'JSWSTEEL', 'KOTAKBANK',
  'ONGC', 'ADANIGREEN', 'COALINDIA', 'HDFCLIFE', 'SBILIFE', 'BPCL', 'CIPLA', 'DRREDDY', 'TECHM', 'GRASIM',
  'TATA CONSUM', 'DIVISLAB', 'SHREECEM', 'ADANIPORTS', 'VEDL', 'EASEMYTRIP', 'AWL', 'SIEMENS', 'ATGL', 'HAL',
  'COLPAL', 'HINDZINC', 'GAIL', 'IDBI', 'DLF', 'ICICIGI', 'M&M', 'ADANITRANS', 'BANDHANBNK', 'LIC',
  'WIPRO', 'HCLTECH', 'TATAMOTORS', 'TATAPOWER', 'ADANIPOWER', 'IOC', 'HAVELLS', 'BAJAJ-AUTO', 'ASIANPAINT',
  'NESTLEIND', 'BRITANNIA', 'DMART', 'TATACHEM', 'Bajaj finserv', 'SBI Cards', 'IDFCFIRSTB', 'Airtel',
  'Tata consumer', 'Krafton', 'ZOMATO', 'Nykaa', 'Policybazaar', 'Firo', 'Pi Industries', 'Piramal Pharma',
  'MGL', 'GMRINFRA', 'CONCOR', 'IRCTC', 'L&T', 'L&TINFOTECH', 'BEL', 'COFORGE', 'PERSISTENT', 'MAPMYINDIA',
  'FINNIFTY', 'NIFTY MIDCAP', 'NIFTY SMALLCAP'
];

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
