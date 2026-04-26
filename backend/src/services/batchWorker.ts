import { YahooFinanceService } from './yahooFinanceService.js';
import {
  setStockData,
  setIndexData,
  batchSetStocks,
  batchSetIndices,
  setScannerCache,
  getScannerCache,
  getAllStocks,
  type StockCacheData,
} from './stockCacheService.js';
import { MarketUniverseService } from './marketUniverseService.js';
import { MARKET_STOCKS_DATA } from '../data/generatedStocks.js';
import { logger } from '../utils/logger.js';
import type { Index, ScreenerMetric, Quote } from './marketTypes.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const BATCH_SIZE = 20;           // Yahoo Finance Spark API safe limit
const BATCH_DELAY_MS = 600;      // Base delay between batches (ms)
const MAX_RETRIES = 3;           // Per-batch retry attempts
const RETRY_BASE_MS = 1_200;     // Base retry delay (doubles each attempt)
const LOG_PROGRESS_EVERY = 5;    // Log progress every N batches

// ── Types ────────────────────────────────────────────────────────────────────
export interface BatchJobResult {
  success: boolean;
  stocksProcessed: number;
  indicesProcessed: number;
  scannerProcessed: number;
  errors: string[];
  skipped: number;
  timestamp: string;
  durationMs: number;
}

interface ScannerResults {
  gainers:     Quote[];
  losers:      Quote[];
  volumeSpike: Quote[];
  rsiOversold: Quote[];
  rsiOverbought: Quote[];
  breakouts:   Quote[];
  breakdowns:  Quote[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/** Randomised jitter: base ± 25% */
function jitter(ms: number): number {
  return ms * (0.75 + Math.random() * 0.5);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.round(ms)));
}

function quoteToCacheData(quote: Quote): StockCacheData {
  return {
    symbol:       quote.symbol,
    price:        quote.price,
    change:       quote.change,
    changePercent: quote.changePercent,
    volume:       quote.volume,
    dayHigh:      quote.dayHigh,
    dayLow:       quote.dayLow,
    previousClose: quote.previousClose,
    open:         quote.open,
    high52w:      quote.high52w,
    low52w:       quote.low52w,
    marketCap:    quote.marketCap,
    marketState:  quote.marketState,
    exchange:     quote.exchange,
    timestamp:    quote.timestamp,
  };
}

// ── Index fetch ───────────────────────────────────────────────────────────────
async function fetchAndCacheIndices(indices: string[]): Promise<number> {
  if (!indices.length) return 0;

  try {
    const quotes = await YahooFinanceService.getQuotes(indices);
    const valid = quotes
      .filter(q => q.price > 0)
      .map(q => ({
        symbol:       q.symbol,
        shortName:    q.name,
        rawSymbol:    q.symbol,
        exchange:     q.exchange,
        price:        q.price,
        change:       q.change,
        changePercent: q.changePercent,
        volume:       q.volume,
        previousClose: q.previousClose,
        dayHigh:      q.dayHigh,
        dayLow:       q.dayLow,
        marketState:  q.marketState,
        timestamp:    q.timestamp,
        isStale:      q.isStale,
      } as Index));

    if (valid.length > 0) await batchSetIndices(valid);
    return valid.length;
  } catch (err) {
    logger.warn(`Indices batch failed: ${(err as Error).message}`);
    return 0;
  }
}

// ── Per-batch stock fetch with retry ─────────────────────────────────────────
async function fetchBatchWithRetry(symbols: string[], attempt = 1): Promise<{ cached: number; failed: string[] }> {
  try {
    const quotes  = await YahooFinanceService.getQuotes(symbols);
    const valid   = quotes.filter(q => q.price > 0 && q.symbol);
    const invalid = quotes.filter(q => q.price <= 0).map(q => q.symbol);

    if (valid.length > 0) {
      const cacheData: StockCacheData[] = valid.map(quoteToCacheData);
      await batchSetStocks(cacheData);
    }

    return { cached: valid.length, failed: invalid };
  } catch (err) {
    const msg = (err as Error).message;
    const is429 = msg.includes('429') || msg.includes('Too Many Requests');

    if (attempt <= MAX_RETRIES) {
      const delay = jitter(RETRY_BASE_MS * Math.pow(2, attempt - 1)) + (is429 ? 5_000 : 0);
      logger.warn(`Batch retry ${attempt}/${MAX_RETRIES} in ${Math.round(delay)}ms — ${msg}`);
      await sleep(delay);
      return fetchBatchWithRetry(symbols, attempt + 1);
    }

    logger.error(`Batch permanently failed after ${MAX_RETRIES} retries: ${msg}`);
    return { cached: 0, failed: symbols };
  }
}

// ── Scanner computation ───────────────────────────────────────────────────────
async function computeScannerResults(quotes: Quote[]): Promise<ScannerResults> {
  const usable = quotes.filter(q => q.price > 0 && q.volume > 0);

  // Sort helpers
  const byChangeDesc = [...usable].sort((a, b) => b.changePercent - a.changePercent);
  const byChangeAsc  = [...usable].sort((a, b) => a.changePercent - b.changePercent);
  const byVolDesc    = [...usable].sort((a, b) => b.volume - a.volume);

  // Compute average volume across the universe for spike detection
  const totalVolume = usable.reduce((sum, q) => sum + q.volume, 0);
  const avgVolume   = usable.length > 0 ? totalVolume / usable.length : 0;

  // Volume spikes: volume > 3× universe average and meaningful move
  const volumeSpike = usable.filter(q =>
    avgVolume > 0 && q.volume > avgVolume * 3 && Math.abs(q.changePercent) >= 0.5
  ).sort((a, b) => b.volume - a.volume).slice(0, 50);

  // RSI signals — approximate from 52-week position + session change
  // (full RSI requires history; here we use a heuristic for fast batch scan)
  const rsiOversold = usable.filter(q => {
    if (!q.high52w || !q.low52w || q.high52w <= q.low52w) return false;
    const pos = ((q.price - q.low52w) / (q.high52w - q.low52w)) * 100;
    return pos < 20 && q.changePercent <= -0.5;
  }).sort((a, b) => a.changePercent - b.changePercent).slice(0, 50);

  const rsiOverbought = usable.filter(q => {
    if (!q.high52w || !q.low52w || q.high52w <= q.low52w) return false;
    const pos = ((q.price - q.low52w) / (q.high52w - q.low52w)) * 100;
    return pos > 85 && q.changePercent >= 0.5;
  }).sort((a, b) => b.changePercent - a.changePercent).slice(0, 50);

  // Breakouts: near 52-week high (≥ 95% of range) with volume spike
  const breakouts = usable.filter(q => {
    if (!q.high52w || !q.low52w || q.high52w <= q.low52w) return false;
    const pos = ((q.price - q.low52w) / (q.high52w - q.low52w)) * 100;
    return pos >= 95 && q.volume > avgVolume * 1.5 && q.changePercent >= 1;
  }).sort((a, b) => b.changePercent - a.changePercent).slice(0, 30);

  // Breakdowns: near 52-week low with heavy selling volume
  const breakdowns = usable.filter(q => {
    if (!q.high52w || !q.low52w || q.high52w <= q.low52w) return false;
    const pos = ((q.price - q.low52w) / (q.high52w - q.low52w)) * 100;
    return pos <= 5 && q.volume > avgVolume * 1.5 && q.changePercent <= -1;
  }).sort((a, b) => a.changePercent - b.changePercent).slice(0, 30);

  return {
    gainers:      byChangeDesc.slice(0, 50),
    losers:       byChangeAsc.slice(0, 50),
    volumeSpike,
    rsiOversold,
    rsiOverbought,
    breakouts,
    breakdowns,
  };
}

// ── Main batch job ────────────────────────────────────────────────────────────
export async function runBatchJob(): Promise<BatchJobResult> {
  const errors:   string[] = [];
  let stocksProcessed = 0;
  let indicesProcessed = 0;
  let scannerProcessed = 0;
  let skipped = 0;
  const startTime = Date.now();

  logger.info('▶ Starting market data batch job');

  // ── 1. Indices ────────────────────────────────────────────────────────────
  try {
    const indices = MarketUniverseService.getIndexSymbols();
    indicesProcessed = await fetchAndCacheIndices(indices);
    logger.info(`✔ Indices: ${indicesProcessed} cached`);
  } catch (err) {
    const msg = `Indices failed: ${(err as Error).message}`;
    errors.push(msg);
    logger.error(msg);
  }

  // ── 2. Stocks ─────────────────────────────────────────────────────────────
  let allQuotesForScanner: Quote[] = [];

  try {
    const stockSymbols = Object.keys(MARKET_STOCKS_DATA);

    if (!stockSymbols.length) {
      logger.warn('Stock universe empty — batch skipped');
      errors.push('Stock universe returned 0 symbols');
    } else {
      const batches     = chunkArray(stockSymbols, BATCH_SIZE);
      const totalBatches = batches.length;
      let failedSymbols: string[] = [];

      logger.info(`Processing ${stockSymbols.length} stocks in ${totalBatches} batches of ${BATCH_SIZE}`);

      const results = await Promise.allSettled(
        batches.map(async (batch, batchIdx) => {
          // Stagger batches to avoid rate limits
          await sleep(jitter(BATCH_DELAY_MS * batchIdx));
          const result = await fetchBatchWithRetry(batch);

          if ((batchIdx + 1) % LOG_PROGRESS_EVERY === 0 || batchIdx + 1 === totalBatches) {
            logger.info(`Batch ${batchIdx + 1}/${totalBatches} — cached: ${result.cached}, failed: ${result.failed.length}`);
          }

          return result;
        })
      );

      for (const settled of results) {
        if (settled.status === 'fulfilled') {
          stocksProcessed += settled.value.cached;
          skipped         += settled.value.failed.length;
          failedSymbols.push(...settled.value.failed);
        } else {
          const msg = `Batch rejected: ${(settled.reason as Error).message}`;
          errors.push(msg);
          logger.error(msg);
        }
      }

      if (failedSymbols.length > 0) {
        logger.warn(`${failedSymbols.length} symbols failed: ${failedSymbols.slice(0, 10).join(', ')}${failedSymbols.length > 10 ? '...' : ''}`);
      }

      logger.info(`✔ Stocks: ${stocksProcessed} cached, ${skipped} failed/empty`);
    }
  } catch (err) {
    const msg = `Stock batch job failed: ${(err as Error).message}`;
    errors.push(msg);
    logger.error(msg);
  }

  // ── 3. Scanner computation ────────────────────────────────────────────────
  try {
    // Fetch all cached quotes for scanner analysis
    const cached = await getAllStocks();
    const quotes: Quote[] = cached.map(s => ({
      symbol:        s.symbol,
      name:          s.symbol,
      price:         s.price,
      change:        s.change,
      changePercent: s.changePercent,
      volume:        s.volume,
      dayHigh:       s.dayHigh,
      dayLow:        s.dayLow,
      previousClose: s.previousClose,
      open:          s.open,
      high52w:       s.high52w,
      low52w:        s.low52w,
      marketCap:     s.marketCap,
      currency:      'INR',
      marketState:   s.marketState,
      exchange:      s.exchange,
      timestamp:     s.timestamp,
      isStale:       false,
    }));

    if (quotes.length > 0) {
      const scanner = await computeScannerResults(quotes);
      await setScannerCache('gainers',      scanner.gainers);
      await setScannerCache('losers',       scanner.losers);
      await setScannerCache('volumeSpike',  scanner.volumeSpike);
      await setScannerCache('rsiOversold',  scanner.rsiOversold);
      await setScannerCache('rsiOverbought',scanner.rsiOverbought);
      await setScannerCache('breakouts',    scanner.breakouts);
      await setScannerCache('breakdowns',   scanner.breakdowns);

      scannerProcessed = (
        scanner.gainers.length +
        scanner.losers.length +
        scanner.volumeSpike.length +
        scanner.rsiOversold.length +
        scanner.rsiOverbought.length +
        scanner.breakouts.length +
        scanner.breakdowns.length
      );

      logger.info(`✔ Scanner: gainers=${scanner.gainers.length} losers=${scanner.losers.length} breakouts=${scanner.breakouts.length} volSpike=${scanner.volumeSpike.length}`);
    } else {
      logger.warn('Scanner skipped — no cached stock data available yet');
    }
  } catch (err) {
    const msg = `Scanner computation failed: ${(err as Error).message}`;
    errors.push(msg);
    logger.error(msg);
  }

  const durationMs = Date.now() - startTime;
  logger.info(`■ Batch job done in ${durationMs}ms — stocks:${stocksProcessed} indices:${indicesProcessed} scanner:${scannerProcessed} errors:${errors.length}`);

  return {
    success: errors.length === 0,
    stocksProcessed,
    indicesProcessed,
    scannerProcessed,
    errors,
    skipped,
    timestamp: new Date().toISOString(),
    durationMs,
  };
}

// ── Worker lifecycle ──────────────────────────────────────────────────────────
let batchInterval: NodeJS.Timeout | null = null;

export function startBatchWorker(intervalMs = 60_000): void {
  if (batchInterval) {
    logger.warn('Batch worker already running — skipping duplicate start');
    return;
  }

  logger.info(`Starting batch worker — interval: ${intervalMs / 1000}s`);

  // Immediate first run
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

// ── Metrics helpers ────────────────────────────────────────────────────────────
let lastRunResult: BatchJobResult | null = null;

export function getLastRunStatus(): BatchJobResult | null {
  return lastRunResult;
}

export function isJobRunning(): boolean {
  return batchProcessingInProgress;
}

let batchProcessingInProgress = false;

function setJobRunning(running: boolean) {
  batchProcessingInProgress = running;
}

// Patch runBatchJob to track status
const originalRunBatchJob = runBatchJob;
async function trackedRunBatchJob(): Promise<BatchJobResult> {
  setJobRunning(true);
  try {
    const result = await originalRunBatchJob();
    lastRunResult = result;
    return result;
  } finally {
    setJobRunning(false);
  }
}
