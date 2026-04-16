import axios from 'axios';
import {
  findIndexDefinition,
  findStockDefinition,
  MARKET_INDICES,
  MARKET_STOCKS,
  NIFTY_50_STOCKS,
  type MarketStockDefinition,
} from '../data/marketCatalog.js';
import { logger } from '../utils/logger.js';
import { MarketUniverseService } from './marketUniverseService.js';
import type { Index, Quote, ScreenerMetric, SectorOverview, StockResearch } from './marketTypes.js';

const QUOTE_BATCH_SIZE = 20;
const SUMMARY_CONCURRENCY = 4;
const HTTP_TIMEOUT_MS = 12_000;

const CACHE_TTL = {
  quote: 20_000,
  summary: 30 * 60 * 1000,
  historyShort: 2 * 60 * 1000,
  historyMedium: 15 * 60 * 1000,
  historyLong: 60 * 60 * 1000,
  analytics: 10 * 60 * 1000,
  marketSummary: 20_000,
  sectorOverview: 30_000,
} as const;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface YahooTarget {
  requestSymbol: string;
  symbol: string;
  name: string;
  yahooSymbol: string;
  exchange: 'NSE' | 'BSE';
  isIndex: boolean;
  sectors?: string[];
  inNifty50?: boolean;
  shortName?: string;
}

interface YahooSparkMeta {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketVolume?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketTime?: number;
  fullExchangeName?: string;
  exchangeName?: string;
  currency?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface YahooSparkResponseItem {
  meta?: YahooSparkMeta;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
    }>;
  };
}

interface YahooSparkResult {
  symbol?: string;
  response?: YahooSparkResponseItem[];
}

interface YahooSparkResponse {
  spark?: {
    result?: YahooSparkResult[];
    error?: { description?: string } | null;
  };
}

interface YahooChartQuote {
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
  volume?: Array<number | null>;
}

interface YahooChartResult {
  timestamp?: number[];
  indicators?: {
    quote?: YahooChartQuote[];
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: { description?: string } | null;
  };
}


interface FundamentalSnapshot {
  sector: string;
  industry: string;
  peRatio: number | null;
  forwardPe: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  beta: number | null;
  revenueGrowth: number | null;
  profitMargins: number | null;
  targetMeanPrice: number | null;
}

const http = axios.create({
  baseURL: 'https://query1.finance.yahoo.com',
  timeout: HTTP_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 InsightForge/2.0',
  },
});

const cache = new Map<string, CacheEntry<unknown>>();

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T, ttl: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });

  if (cache.size > 1_000) {
    const now = Date.now();
    for (const [entryKey, entryValue] of cache.entries()) {
      if (entryValue.expiresAt < now) {
        cache.delete(entryKey);
      }
    }
  }
}

async function mapLimit<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (!items.length) return [];

  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function toYahooEquitySymbol(stock: MarketStockDefinition): string {
  const configured = stock.yahooSymbol?.trim();
  if (configured && (configured.startsWith('^') || configured.includes('.'))) {
    return configured;
  }
  return `${stock.symbol}.NS`;
}

function resolveTarget(query: string): YahooTarget {
  const normalized = normalizeSymbol(query);
  const index = findIndexDefinition(normalized);
  if (index) {
    return {
      requestSymbol: normalized,
      symbol: index.name,
      name: index.name,
      yahooSymbol: index.yahooSymbol,
      exchange: 'NSE',
      isIndex: true,
      shortName: index.shortName,
    };
  }

  const stock = findStockDefinition(normalized);
  if (stock) {
    return {
      requestSymbol: normalized,
      symbol: stock.symbol,
      name: stock.name,
      yahooSymbol: toYahooEquitySymbol(stock),
      exchange: stock.exchange,
      isIndex: false,
      sectors: stock.sectors,
      inNifty50: stock.inNifty50,
    };
  }

  if (normalized.startsWith('^') || normalized.endsWith('.NS') || normalized.endsWith('.BO')) {
    const exchange = normalized.endsWith('.BO') ? 'BSE' : 'NSE';
    return {
      requestSymbol: normalized,
      symbol: normalized.replace(/\.(NS|BO)$/i, ''),
      name: normalized,
      yahooSymbol: normalized,
      exchange,
      isIndex: normalized.startsWith('^'),
    };
  }

  return {
    requestSymbol: normalized,
    symbol: normalized,
    name: normalized,
    yahooSymbol: `${normalized}.NS`,
    exchange: 'NSE',
    isIndex: false,
  };
}

function emptyQuote(target: YahooTarget): Quote {
  return {
    symbol: target.symbol,
    name: target.name,
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    dayHigh: 0,
    dayLow: 0,
    previousClose: 0,
    open: 0,
    high52w: 0,
    low52w: 0,
    marketCap: 0,
    currency: 'INR',
    marketState: 'CLOSED',
    exchange: target.exchange,
    timestamp: new Date().toISOString(),
    isStale: true,
  };
}


function getSessionOpenPrice(response: YahooSparkResponseItem | undefined, meta: YahooSparkMeta | undefined): number {
  const closes = response?.indicators?.quote?.[0]?.close || [];
  const firstTrade = closes.find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  return Number(firstTrade || meta?.previousClose || meta?.chartPreviousClose || meta?.regularMarketPrice || 0);
}

function toSparkQuote(target: YahooTarget, response: YahooSparkResponseItem | undefined): Quote {
  const meta = response?.meta;
  const price = Number(meta?.regularMarketPrice || 0);
  const previousClose = Number(meta?.previousClose || meta?.chartPreviousClose || 0);
  const timestamp = meta?.regularMarketTime
    ? new Date(meta.regularMarketTime * 1000).toISOString()
    : new Date().toISOString();
  const exchangeName = String(meta?.fullExchangeName || meta?.exchangeName || '').toLowerCase();
  const exchange = exchangeName.includes('bombay') || exchangeName === 'bse' ? 'BSE' : target.exchange;

  return {
    symbol: target.symbol,
    name: meta?.longName || meta?.shortName || target.name,
    price,
    change: Number(price - previousClose),
    changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
    volume: Number(meta?.regularMarketVolume || 0),
    dayHigh: Number(meta?.regularMarketDayHigh || price || 0),
    dayLow: Number(meta?.regularMarketDayLow || price || 0),
    previousClose,
    open: getSessionOpenPrice(response, meta),
    high52w: Number(meta?.fiftyTwoWeekHigh || 0),
    low52w: Number(meta?.fiftyTwoWeekLow || 0),
    marketCap: 0,
    currency: meta?.currency || 'INR',
    marketState: 'REGULAR',
    exchange,
    timestamp,
    isStale: false,
  };
}

function toIndex(quote: Quote, fallback: typeof MARKET_INDICES[number]): Index {
  return {
    symbol: fallback.name,
    shortName: fallback.shortName,
    rawSymbol: fallback.yahooSymbol,
    exchange: quote.exchange,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    volume: quote.volume,
    previousClose: quote.previousClose,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    marketState: quote.marketState,
    timestamp: quote.timestamp,
    isStale: quote.isStale,
  };
}

function getHistoryTtl(period: string): number {
  if (period === '15m' || period === '1d' || period === '5d') return CACHE_TTL.historyShort;
  if (period === '1mo' || period === '3mo') return CACHE_TTL.historyMedium;
  return CACHE_TTL.historyLong;
}

function getHistoryParams(period: string): { range: string; interval: string } {
  switch (period) {
    case '15m':
      return { range: '1d', interval: '15m' };
    case '1d':
      return { range: '1d', interval: '5m' };
    case '5d':
      return { range: '5d', interval: '15m' };
    case '1mo':
      return { range: '1mo', interval: '1d' };
    case '3mo':
      return { range: '3mo', interval: '1d' };
    case '6mo':
      return { range: '6mo', interval: '1d' };
    case '1y':
      return { range: '1y', interval: '1d' };
    case '2y':
      return { range: '2y', interval: '1d' };
    case '5y':
      return { range: '5y', interval: '1wk' };
    case '10y':
      return { range: '10y', interval: '1mo' };
    default:
      return { range: '3mo', interval: '1d' };
  }
}

function calculateSma(values: number[], period: number): number {
  if (!values.length) return 0;
  const window = values.slice(-Math.min(period, values.length));
  return average(window);
}

function calculateEma(values: number[], period: number): number {
  if (!values.length) return 0;
  const multiplier = 2 / (Math.min(period, values.length) + 1);
  let ema = values[0];
  for (let index = 1; index < values.length; index += 1) {
    ema = (values[index] - ema) * multiplier + ema;
  }
  return ema;
}

function calculateRsi(values: number[], period = 14): number {
  if (values.length < 2) return 50;

  const deltas = values.slice(1).map((value, index) => value - values[index]);
  const window = deltas.slice(-Math.min(period, deltas.length));
  const gains = window.filter((value) => value > 0);
  const losses = window.filter((value) => value < 0).map(Math.abs);
  const avgGain = average(gains);
  const avgLoss = average(losses);

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const relativeStrength = avgGain / avgLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function getTrendLabel(score: number): 'bullish' | 'bearish' | 'neutral' {
  if (score >= 25) return 'bullish';
  if (score <= -25) return 'bearish';
  return 'neutral';
}

const FETCH_RETRY_BASE_MS = 1_000;
const FETCH_MAX_RETRIES   = 3;

function fetchSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.round(ms * (0.8 + Math.random() * 0.4))));
}

async function fetchQuoteBatchOnce(targets: YahooTarget[]): Promise<Map<string, Quote>> {
  const response = await http.get<YahooSparkResponse>('/v7/finance/spark', {
    params: {
      symbols: targets.map((target) => target.yahooSymbol).join(','),
      range: '1d',
      interval: '5m',
      indicators: 'close',
      includeTimestamps: true,
      includePrePost: false,
      lang: 'en-US',
      region: 'IN',
    },
  });

  const rawResults = response.data.spark?.result || [];
  const byYahooSymbol = new Map<string, YahooSparkResponseItem>();
  for (const result of rawResults) {
    const symbol = result.symbol || result.response?.[0]?.meta?.symbol;
    const payload = result.response?.[0];
    if (!symbol || !payload) continue;
    byYahooSymbol.set(symbol.toUpperCase(), payload);
  }

  const mapped = new Map<string, Quote>();
  for (const target of targets) {
    const rawQuote = byYahooSymbol.get(target.yahooSymbol.toUpperCase());
    const quote = rawQuote ? toSparkQuote(target, rawQuote) : emptyQuote(target);
    cacheSet(`yahoo:quote:${target.yahooSymbol}`, quote, CACHE_TTL.quote);
    mapped.set(target.requestSymbol, quote);
  }

  return mapped;
}

async function fetchQuoteBatch(targets: YahooTarget[], attempt = 1): Promise<Map<string, Quote>> {
  try {
    return await fetchQuoteBatchOnce(targets);
  } catch (error) {
    const msg    = (error as Error).message;
    const is429  = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate limit');
    const isNet  = msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('timeout');
    const canRetry = (is429 || isNet) && attempt <= FETCH_MAX_RETRIES;

    if (canRetry) {
      const delay = FETCH_RETRY_BASE_MS * Math.pow(2, attempt - 1) + (is429 ? 4_000 : 0);
      logger.warn(`Yahoo Spark retry ${attempt}/${FETCH_MAX_RETRIES} in ${Math.round(delay)}ms (${is429 ? '429' : 'net'})`);
      await fetchSleep(delay);
      return fetchQuoteBatch(targets, attempt + 1);
    }

    logger.warn(`Yahoo Spark batch failed permanently: ${msg}`);
    const fallback = new Map<string, Quote>();
    for (const target of targets) fallback.set(target.requestSymbol, emptyQuote(target));
    return fallback;
  }
}

async function getQuotesForTargets(targets: YahooTarget[]): Promise<Quote[]> {
  const results = new Map<string, Quote>();
  const missing: YahooTarget[] = [];

  for (const target of targets) {
    const cachedQuote = cacheGet<Quote>(`yahoo:quote:${target.yahooSymbol}`);
    if (cachedQuote) {
      results.set(target.requestSymbol, cachedQuote);
      continue;
    }
    missing.push(target);
  }

  // Use allSettled so one failing batch does not abort the others
  const batches  = chunk(missing, QUOTE_BATCH_SIZE);
  const settled  = await Promise.allSettled(batches.map(batch => fetchQuoteBatch(batch)));

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      for (const [symbol, quote] of outcome.value.entries()) {
        results.set(symbol, quote);
      }
    } else {
      logger.warn(`Batch rejected in allSettled: ${(outcome.reason as Error).message}`);
    }
  }

  return targets.map((target) => results.get(target.requestSymbol) || emptyQuote(target));
}

async function getSummary(target: YahooTarget): Promise<FundamentalSnapshot> {
  const cacheKey = `yahoo:summary:${target.yahooSymbol}`;
  const cached = cacheGet<FundamentalSnapshot>(cacheKey);
  if (cached) return cached;

  const fallback: FundamentalSnapshot = {
    sector: target.sectors?.[0] || 'Unclassified',
    industry: target.isIndex ? 'Index' : 'Equity',
    peRatio: null,
    forwardPe: null,
    priceToBook: null,
    dividendYield: null,
    beta: null,
    revenueGrowth: null,
    profitMargins: null,
    targetMeanPrice: null,
  };

  cacheSet(cacheKey, fallback, CACHE_TTL.summary);
  return fallback;
}

function buildScreenerMetric(target: YahooTarget, quote: Quote, history: Array<{ close: number; volume: number }>, summary: FundamentalSnapshot): ScreenerMetric {
  const closes = history.map((bar) => bar.close).filter((value) => Number.isFinite(value) && value > 0);
  const volumes = history.map((bar) => bar.volume).filter((value) => Number.isFinite(value) && value > 0);
  const sma20 = calculateSma(closes, 20);
  const sma50 = calculateSma(closes, 50);
  const ema21 = calculateEma(closes, 21);
  const rsi14 = calculateRsi(closes, 14);
  const avgVolume20 = calculateSma(volumes, 20);
  const volumeRatio = avgVolume20 > 0 ? quote.volume / avgVolume20 : 1;
  const turnover = quote.price * quote.volume;
  const dayRangePercent = quote.price > 0 ? ((quote.dayHigh - quote.dayLow) / quote.price) * 100 : 0;
  const week52RangePosition = quote.high52w > quote.low52w
    ? ((quote.price - quote.low52w) / (quote.high52w - quote.low52w)) * 100
    : 0;
  const distanceFromHigh52 = quote.high52w > 0 ? ((quote.price - quote.high52w) / quote.high52w) * 100 : 0;
  const distanceFromLow52 = quote.low52w > 0 ? ((quote.price - quote.low52w) / quote.low52w) * 100 : 0;
  const momentumScore = clamp(
    quote.changePercent * 7
      + (quote.price > sma20 ? 10 : -10)
      + (quote.price > sma50 ? 14 : -14)
      + (quote.price > ema21 ? 8 : -8)
      + (rsi14 - 50) * 0.9
      + (volumeRatio - 1) * 12,
    -100,
    100,
  );

  return {
    symbol: quote.symbol,
    name: quote.name,
    sector: summary.sector,
    industry: summary.industry,
    exchange: quote.exchange,
    currentPrice: quote.price,
    changePercent: quote.changePercent,
    volume: quote.volume,
    turnover,
    dayRangePercent,
    week52RangePosition,
    distanceFromHigh52,
    distanceFromLow52,
    momentumScore,
    liquidityScore: clamp(Math.log10(Math.max(turnover, 1)) * 12, 0, 100),
    high52: quote.high52w,
    low52: quote.low52w,
    inNifty50: Boolean(target.inNifty50),
    peRatio: summary.peRatio,
    forwardPe: summary.forwardPe,
    priceToBook: summary.priceToBook,
    dividendYield: summary.dividendYield === null ? null : summary.dividendYield * 100,
    beta: summary.beta,
    revenueGrowth: summary.revenueGrowth === null ? null : summary.revenueGrowth * 100,
    profitMargins: summary.profitMargins === null ? null : summary.profitMargins * 100,
    targetMeanPrice: summary.targetMeanPrice,
    rsi14,
    sma20,
    sma50,
    volumeRatio,
    trend: getTrendLabel(momentumScore),
  };
}

export class YahooFinanceService {
  static async getQuote(symbol: string): Promise<Quote | null> {
    const [quote] = await this.getQuotes([symbol]);
    return quote?.price ? quote : null;
  }

  static async getIndex(symbol: string): Promise<Index | null> {
    const indices = await this.getIndices();
    return indices.find(idx => idx.symbol === symbol || idx.symbol.includes(symbol)) || null;
  }

  static async getQuotes(symbols: string[]): Promise<Quote[]> {
    const targets = unique(symbols.map(resolveTarget).filter((target) => Boolean(target.requestSymbol)));
    return getQuotesForTargets(targets);
  }

  static async getIndices(): Promise<Index[]> {
    const quotes = await this.getQuotes(MARKET_INDICES.map((index) => index.name));
    const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));

    return MARKET_INDICES.map((index) => {
      const quote = bySymbol.get(index.name) || emptyQuote(resolveTarget(index.name));
      return toIndex(quote, index);
    });
  }

  static async getMarketMovers(type = 'gainers', count = 50): Promise<Quote[]> {
    const universeQuotes = await this.getQuotes(MARKET_STOCKS.map((stock) => stock.symbol));
    const usable = universeQuotes.filter((quote) => quote.price > 0);
    const sorted = [...usable].sort((left, right) => {
      if (type === 'losers') return left.changePercent - right.changePercent;
      if (type === 'active') return right.volume - left.volume;
      return right.changePercent - left.changePercent;
    });
    return sorted.slice(0, count);
  }

  static async getHistoricalData(symbol: string, period = '1mo') {
    const target = resolveTarget(symbol);
    const cacheKey = `yahoo:history:${target.yahooSymbol}:${period}`;
    const cached = cacheGet<Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>>(cacheKey);
    if (cached) return cached;

    const { range, interval } = getHistoryParams(period);
    try {
      const response = await http.get<YahooChartResponse>(`/v8/finance/chart/${encodeURIComponent(target.yahooSymbol)}`, {
        params: {
          range,
          interval,
          includePrePost: false,
          events: 'div,splits',
          lang: 'en-US',
          region: 'IN',
        },
      });

      const chart = response.data.chart?.result?.[0];
      const quote = chart?.indicators?.quote?.[0];
      const timestamps = chart?.timestamp || [];
      const bars = timestamps
        .map((timestamp, index) => ({
          date: new Date(timestamp * 1000).toISOString(),
          open: Number(quote?.open?.[index] || 0),
          high: Number(quote?.high?.[index] || 0),
          low: Number(quote?.low?.[index] || 0),
          close: Number(quote?.close?.[index] || 0),
          volume: Number(quote?.volume?.[index] || 0),
        }))
        .filter((bar) => bar.close > 0);

      cacheSet(cacheKey, bars, getHistoryTtl(period));
      return bars;
    } catch (error) {
      logger.warn(`Yahoo history failed for ${symbol}: ${(error as Error).message}`);
      return [];
    }
  }

  static async getScreenerMetrics(symbols: string[]): Promise<ScreenerMetric[]> {
    const normalizedSymbols = unique(symbols.map(normalizeSymbol).filter(Boolean));
    const cacheKey = `yahoo:analytics:${normalizedSymbols.join(',')}`;
    const cached = cacheGet<ScreenerMetric[]>(cacheKey);
    if (cached) return cached;

    const targets = normalizedSymbols.map(resolveTarget);
    const quotes = await getQuotesForTargets(targets);

    const metrics = await mapLimit(targets, SUMMARY_CONCURRENCY, async (target, index) => {
      const quote = quotes[index] || emptyQuote(target);
      const [history, summary] = await Promise.all([
        this.getHistoricalData(target.symbol, '3mo'),
        getSummary(target),
      ]);

      return buildScreenerMetric(target, quote, history, summary);
    });

    cacheSet(cacheKey, metrics, CACHE_TTL.analytics);
    return metrics;
  }

  static async getStocksBySector(sector: string): Promise<Quote[]> {
    const universeStocks = await MarketUniverseService.getStocksBySector(sector, 80);
    if (!universeStocks.length) return [];

    const quotes = await this.getQuotes(universeStocks.map((stock) => stock.symbol));
    return quotes
      .filter((quote) => quote.price > 0)
      .sort((left, right) => right.changePercent - left.changePercent);
  }

  static async getAllSectorsData(): Promise<SectorOverview[]> {
    const cacheKey = 'yahoo:sectors:overview';
    const cached = cacheGet<SectorOverview[]>(cacheKey);
    if (cached) return cached;

    const sectorGroups = await MarketUniverseService.getSectorGroups();
    const sampledSymbols = unique(
      sectorGroups.flatMap((group) => group.symbols.slice(0, 24)),
    );
    const quotes = await this.getQuotes(sampledSymbols);
    const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));

    const data = sectorGroups
      .map((group) => {
        const sectorQuotes = group.symbols
          .slice(0, 24)
          .map((symbol) => quoteMap.get(symbol))
          .filter((quote): quote is Quote => quote !== undefined && quote !== null && quote.price > 0);

        const avgChangePercent = average(sectorQuotes.map((quote) => quote.changePercent));
        const bullishCount = sectorQuotes.filter((quote) => quote.changePercent >= 0.75).length;
        const bearishCount = sectorQuotes.filter((quote) => quote.changePercent <= -0.75).length;
        const breadth = sectorQuotes.length ? ((bullishCount - bearishCount) / sectorQuotes.length) * 100 : 0;
        const ordered = [...sectorQuotes].sort((left, right) => right.changePercent - left.changePercent);
        const trend: SectorOverview['trend'] = avgChangePercent >= 0.6
          ? 'bullish'
          : avgChangePercent <= -0.6
            ? 'bearish'
            : 'neutral';

        return {
          sector: group.sector,
          trend,
          averageChangePercent: avgChangePercent,
          breadth,
          bullishCount,
          bearishCount,
          stockCount: group.stockCount,
          sampleSize: sectorQuotes.length,
          leader: ordered[0] || null,
          laggard: ordered.at(-1) || null,
          stocks: ordered.slice(0, 6),
          lastUpdated: new Date().toISOString(),
        };
      })
      .filter((entry) => entry.stockCount > 0)
      .sort((left, right) => Math.abs(right.averageChangePercent || 0) - Math.abs(left.averageChangePercent || 0));

    cacheSet(cacheKey, data, CACHE_TTL.sectorOverview);
    return data;
  }

  static async getStockResearch(symbol: string): Promise<StockResearch> {
    const normalized = normalizeSymbol(symbol);
    const resolved = await MarketUniverseService.resolveSymbols([normalized]);
    const universeEntry = resolved.get(normalized);
    const canonicalSymbol = universeEntry?.symbol || normalized;

    const [quote, analyticsRows, sectorOverview] = await Promise.all([
      this.getQuote(canonicalSymbol),
      this.getScreenerMetrics([canonicalSymbol]),
      this.getAllSectorsData(),
    ]);

    const analytics = analyticsRows[0] || null;
    const primarySector = analytics?.sector || universeEntry?.sectors[0] || 'Unclassified';
    const peers = primarySector && primarySector !== 'Unclassified'
      ? (await this.getScreenerMetrics((await MarketUniverseService.getStocksBySector(primarySector, 10)).map((entry) => entry.symbol)))
        .filter((entry) => entry.symbol !== canonicalSymbol)
        .slice(0, 6)
      : [];

    const profileName = universeEntry?.name || quote?.name || analytics?.name || canonicalSymbol;
    const sectors = universeEntry?.sectors?.length ? universeEntry.sectors : primarySector !== 'Unclassified' ? [primarySector] : [];

    return {
      profile: {
        symbol: canonicalSymbol,
        name: profileName,
        exchange: universeEntry?.exchange || quote?.exchange || 'NSE',
        sectors,
        primarySector,
        industry: universeEntry?.industry || analytics?.industry || undefined,
        isin: universeEntry?.isin,
        aliases: universeEntry?.aliases || [],
        inNifty50: Boolean(universeEntry?.inNifty50 || analytics?.inNifty50),
        narrative: universeEntry?.industry
          ? `${profileName} is tracked in the ${primarySector} basket and mapped to the ${universeEntry.industry} industry segment in the exchange metadata coverage.`
          : `${profileName} is tracked in the ${primarySector} basket with delayed cached market data and derived technical plus valuation analytics.`,
        dataNotes: [
          'Price and volume analytics are derived from delayed cached public market data.',
          'Valuation fields can be partially unavailable when public summary endpoints do not expose them.',
          'Sector grouping is built from cached exchange universe metadata rather than NSE scraping.',
        ],
      },
      quote,
      analytics,
      sectorOverview: sectorOverview.find((entry) => entry.sector === primarySector) || null,
      peers,
    };
  }

  static async getMarketSummary() {
    const cacheKey = 'yahoo:market:summary';
    const cached = cacheGet<{
      indices: Index[];
      gainers: Quote[];
      losers: Quote[];
      mostActive: Quote[];
      lastUpdated: string;
      marketStatus: string;
    }>(cacheKey);
    if (cached) return cached;

    const [indicesResult, quotesResult] = await Promise.allSettled([
      this.getIndices(),
      this.getQuotes(unique([...NIFTY_50_STOCKS, ...MARKET_STOCKS.map((stock) => stock.symbol)])),
    ]);

    const indices = indicesResult.status === 'fulfilled' ? indicesResult.value : [];
    const quotes  = quotesResult.status  === 'fulfilled' ? quotesResult.value  : [];
    if (indicesResult.status === 'rejected') logger.warn(`getMarketSummary indices failed: ${(indicesResult.reason as Error).message}`);
    if (quotesResult.status  === 'rejected') logger.warn(`getMarketSummary quotes failed: ${(quotesResult.reason as Error).message}`);

    const usable = quotes.filter((quote) => quote.price > 0);
    const topMoversCount = 50;
    const summary = {
      indices,
      gainers: [...usable].sort((left, right) => right.changePercent - left.changePercent).slice(0, topMoversCount),
      losers: [...usable].sort((left, right) => left.changePercent - right.changePercent).slice(0, topMoversCount),
      mostActive: [...usable].sort((left, right) => right.volume - left.volume).slice(0, topMoversCount),
      lastUpdated: new Date().toISOString(),
      marketStatus: indices.find((index) => index.price > 0)?.marketState || 'REGULAR',
    };

    cacheSet(cacheKey, summary, CACHE_TTL.marketSummary);
    return summary;
  }

  static async primeHotPathCache(): Promise<void> {
    await Promise.allSettled([
      this.getIndices(),
      this.getMarketSummary(),
      this.getAllSectorsData(),
    ]);
  }
}