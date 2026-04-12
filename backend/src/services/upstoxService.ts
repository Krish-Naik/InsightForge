import axios from 'axios';
import { config } from '../config/index.js';
import { looksLikeJwtToken } from '../config/index.js';
import { logger } from '../utils/logger.js';
import {
  findStockDefinition,
  findIndexDefinition,
  MARKET_INDICES,
  NIFTY_50_STOCKS,
  SECTOR_MAP,
  UPSTOX_INDEX_SYMBOLS,
  UPSTOX_INSTRUMENTS,
} from '../data/marketCatalog.js';
import { MarketUniverseService } from './marketUniverseService.js';
import type { Index, Quote, ScreenerMetric } from './marketTypes.js';

const BASE = 'https://api.upstox.com/v2';
const QUOTE_BATCH_SIZE = 50;
const HOT_SYMBOLS = [...new Set(Object.values(SECTOR_MAP).flat())];

interface CacheEntry {
  d:   unknown;
  t:   number;
  ttl: number;
}

interface ResolvedInstrument {
  requestSymbol: string;
  symbol: string;
  name: string;
  exchange: string;
  instrumentKey: string;
  isin?: string;
}

const STATIC_INSTRUMENTS = UPSTOX_INSTRUMENTS;

// ── In-memory cache ─────────────────────────────────────────────────────────
const C = new Map<string, CacheEntry>();

function cget(k: string): unknown | null {
  const v = C.get(k);
  return v && Date.now() - v.t < v.ttl ? v.d : null;
}

function cset(k: string, d: unknown, ttl = 10_000) {
  C.set(k, { d, t: Date.now(), ttl });
  // Evict stale entries when cache grows large
  if (C.size > 300) {
    const now = Date.now();
    for (const [a, b] of C.entries()) {
      if (now - b.t > b.ttl * 2) C.delete(a);
    }
  }
}

// ── OAuth token management ──────────────────────────────────────────────────
let _token: string | null = null;
let _tokenExpiry = 0;
let _authFailureTime = 0;
const AUTH_RETRY_INTERVAL = 5 * 60 * 1000; // 5 minutes
let _warnedMisplacedAccessToken = false;

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

function getUpstoxErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseError = error.response?.data as {
      errors?: Array<{ message?: string; errorCode?: string; error_code?: string }>;
      status?: string;
    } | undefined;
    const apiMessage = responseError?.errors?.[0]?.message;
    const apiCode = responseError?.errors?.[0]?.errorCode || responseError?.errors?.[0]?.error_code;
    const status = error.response?.status;
    return apiCode ? `${apiMessage || error.message} (${apiCode}${status ? ` / HTTP ${status}` : ''})` : apiMessage || error.message;
  }

  return (error as Error)?.message || 'Unknown Upstox error';
}

function toIndex(quote: Quote): Index {
  const definition = findIndexDefinition(quote.symbol) || MARKET_INDICES.find((index) => index.name === quote.symbol);
  return {
    symbol: definition?.name || quote.symbol,
    shortName: definition?.shortName || quote.name || quote.symbol,
    rawSymbol: definition?.upstoxSymbol || quote.symbol,
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

async function getAccessToken(): Promise<string | null> {
  if (config.upstoxAccessToken) return config.upstoxAccessToken.trim();
  if (looksLikeJwtToken(config.upstoxAuthCode)) {
    if (!_warnedMisplacedAccessToken) {
      logger.warn('UPSTOX_AUTH_CODE contains a JWT-like value. Treating it as UPSTOX_ACCESS_TOKEN. Move it to UPSTOX_ACCESS_TOKEN to avoid auth confusion.');
      _warnedMisplacedAccessToken = true;
    }
    return config.upstoxAuthCode.trim();
  }
  if (_token && Date.now() < _tokenExpiry) return _token;
  
  // Don't retry if auth failed recently
  if (_authFailureTime && Date.now() - _authFailureTime < AUTH_RETRY_INTERVAL) {
    return null;
  }

  const { upstoxAuthCode, upstoxApiKey, upstoxApiSecret, upstoxRedirectUri } = config;
  if (!upstoxAuthCode || !upstoxApiKey || !upstoxApiSecret) {
    logger.warn('Upstox credentials not configured — skipping Upstox auth');
    return null;
  }

  const redirectUri = (upstoxRedirectUri || 'http://localhost:5001/callback').trim();
  logger.info(`Upstox auth - redirect_uri: "${redirectUri}"`);

  try {
    const params = new URLSearchParams();
    params.append('code', upstoxAuthCode.trim());
    params.append('client_id', upstoxApiKey.trim());
    params.append('client_secret', upstoxApiSecret.trim());
    params.append('redirect_uri', redirectUri);
    params.append('grant_type', 'authorization_code');

    logger.info(`Sending token request to ${BASE}/login/authorization/token`);
    
    const res = await axios.post(
      `${BASE}/login/authorization/token`,
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8_000 }
    );
    _token  = res.data.access_token;
    // Expire 60s early so we never hit the API with a stale token
    _tokenExpiry = Date.now() + res.data.expires_in * 1_000 - 60_000;
    logger.info(`Upstox token refreshed (expires in ${res.data.expires_in}s)`);
    return _token;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string; errors?: { message: string }[] } }; message?: string };
    const msg =
      err.response?.data?.message ||
      err.response?.data?.errors?.[0]?.message ||
      err.message ||
      'unknown';
    logger.warn(`Upstox auth failed: ${msg}`);
    _authFailureTime = Date.now();
    return null;
  }
}

async function upstoxGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await axios.get(`${BASE}${endpoint}`, {
    params,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 10_000,
  });
  return res.data as T;
}

// ── Quote mapping ────────────────────────────────────────────────────────────
function emptyQuote(symbol: string, seed?: Partial<Quote>): Quote {
  return {
    symbol,
    name: seed?.name || symbol,
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0, dayHigh: 0, dayLow: 0, previousClose: 0, open: 0,
    high52w: 0, low52w: 0, marketCap: 0, currency: 'INR',
    marketState: 'CLOSED', exchange: seed?.exchange || 'NSE', timestamp: new Date().toISOString(),
    instrumentKey: seed?.instrumentKey,
    isin: seed?.isin,
  };
}

function mapQuote(target: ResolvedInstrument, d: Record<string, unknown>): Quote {
  const ohlc = (d.ohlc as Record<string, number>) || {};
  const lastPrice = (d.last_price as number) || 0;
  const prevClose = ohlc.close || 0;

  const high52w = (d['52_week_high'] as number) || (d.week_52_high as number) || 0;
  const low52w  = (d['52_week_low']  as number) || (d.week_52_low  as number) || 0;
  const stock = findStockDefinition(target.symbol);

  return {
    symbol:        target.symbol,
    name:          stock?.name || target.name || (d.tradingsymbol as string) || (d.name as string) || target.symbol,
    price:         lastPrice,
    change:        prevClose ? lastPrice - prevClose : 0,
    changePercent: prevClose ? ((lastPrice - prevClose) / prevClose) * 100 : 0,
    volume:        (d.volume as number) || 0,
    dayHigh:       ohlc.high || 0,
    dayLow:        ohlc.low  || 0,
    previousClose: prevClose,
    open:          ohlc.open  || 0,
    high52w,
    low52w,
    marketCap:     0,
    currency:      'INR',
    marketState:   'REGULAR',
    exchange:      target.exchange,
    timestamp:     new Date().toISOString(),
    instrumentKey: target.instrumentKey,
    isin:          target.isin,
  };
}

async function resolveTargets(symbols: string[]): Promise<Map<string, ResolvedInstrument>> {
  const resolved = new Map<string, ResolvedInstrument>();
  const unresolved: string[] = [];

  for (const rawSymbol of unique(symbols.map(normalizeSymbol)).filter(Boolean)) {
    const indexDefinition = findIndexDefinition(rawSymbol);
    if (indexDefinition) {
      const instrumentKey = STATIC_INSTRUMENTS[indexDefinition.upstoxSymbol] || STATIC_INSTRUMENTS[indexDefinition.name] || STATIC_INSTRUMENTS[rawSymbol];
      if (instrumentKey) {
        resolved.set(rawSymbol, {
          requestSymbol: rawSymbol,
          symbol: indexDefinition.name,
          name: indexDefinition.name,
          exchange: 'NSE',
          instrumentKey,
        });
        continue;
      }
    }

    const stockDefinition = findStockDefinition(rawSymbol);
    if (stockDefinition?.upstoxInstrumentKey) {
      resolved.set(rawSymbol, {
        requestSymbol: rawSymbol,
        symbol: stockDefinition.symbol,
        name: stockDefinition.name,
        exchange: stockDefinition.exchange,
        instrumentKey: stockDefinition.upstoxInstrumentKey,
        isin: stockDefinition.upstoxInstrumentKey.split('|')[1],
      });
      continue;
    }

    const directInstrumentKey = STATIC_INSTRUMENTS[rawSymbol];
    if (directInstrumentKey) {
      resolved.set(rawSymbol, {
        requestSymbol: rawSymbol,
        symbol: rawSymbol,
        name: rawSymbol,
        exchange: directInstrumentKey.startsWith('BSE') ? 'BSE' : 'NSE',
        instrumentKey: directInstrumentKey,
      });
      continue;
    }

    unresolved.push(rawSymbol);
  }

  if (unresolved.length) {
    const universeMatches = await MarketUniverseService.resolveSymbols(unresolved);
    for (const rawSymbol of unresolved) {
      const match = universeMatches.get(rawSymbol);
      if (!match?.instrumentKey) continue;
      resolved.set(rawSymbol, {
        requestSymbol: rawSymbol,
        symbol: match.symbol,
        name: match.name,
        exchange: match.exchange.includes('NSE') ? 'NSE' : 'BSE',
        instrumentKey: match.instrumentKey,
        isin: match.isin,
      });
    }
  }

  return resolved;
}

function toScreenerMetric(quote: Quote, sector = 'Unknown', industry = 'Unknown', inNifty50 = false): ScreenerMetric {
  const turnover = quote.price * quote.volume;
  const dayRangePercent = quote.price > 0 ? ((quote.dayHigh - quote.dayLow) / quote.price) * 100 : 0;
  const week52RangePosition = quote.high52w > quote.low52w
    ? ((quote.price - quote.low52w) / (quote.high52w - quote.low52w)) * 100
    : 0;
  const distanceFromHigh52 = quote.high52w > 0 ? ((quote.price - quote.high52w) / quote.high52w) * 100 : 0;
  const distanceFromLow52 = quote.low52w > 0 ? ((quote.price - quote.low52w) / quote.low52w) * 100 : 0;
  const intradayStrength = quote.dayHigh > quote.dayLow
    ? ((quote.price - quote.dayLow) / (quote.dayHigh - quote.dayLow)) * 100
    : 50;
  const liquidityScore = clamp(turnover / 50_000_000, 0, 100);
  const momentumScore = clamp(
    quote.changePercent * 6 + (week52RangePosition - 50) * 0.8 + (intradayStrength - 50) * 0.4,
    -100,
    100,
  );

  return {
    symbol: quote.symbol,
    name: quote.name,
    sector,
    industry,
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
    liquidityScore,
    high52: quote.high52w,
    low52: quote.low52w,
    inNifty50,
  };
}

// ── Public service ───────────────────────────────────────────────────────────
export class UpstoxService {

  static async getMarketMoverBuckets() {
    const cacheKey = 'upstox:moverBuckets';
    const cached = cget(cacheKey) as { gainers: Quote[]; losers: Quote[]; volume: Quote[] } | null;
    if (cached) return cached;

    const quotes = await this.getQuotes(HOT_SYMBOLS);
    const valid = quotes.filter((quote) => quote.price > 0);
    const buckets = {
      gainers: valid.filter((quote) => quote.change > 0).sort((left, right) => right.changePercent - left.changePercent),
      losers: valid.filter((quote) => quote.change < 0).sort((left, right) => left.changePercent - right.changePercent),
      volume: [...valid].sort((left, right) => right.volume - left.volume),
    };

    cset(cacheKey, buckets, 30_000);
    return buckets;
  }

  static async getQuotes(symbols: string[]): Promise<Quote[]> {
    const normalizedSymbols = unique(symbols.map(normalizeSymbol)).filter(Boolean);
    const cacheKey = `q:${[...normalizedSymbols].sort().join(',')}`;
    const cached = cget(cacheKey) as Quote[] | null;
    if (cached) return cached;

    const resolved = await resolveTargets(normalizedSymbols);
    const instrumentKeys = unique(
      normalizedSymbols
        .map((symbol) => resolved.get(symbol)?.instrumentKey)
        .filter((value): value is string => Boolean(value)),
    );

    if (!instrumentKeys.length) return normalizedSymbols.map((symbol) => emptyQuote(symbol));

    try {
      const payloads = await Promise.all(
        chunk(instrumentKeys, QUOTE_BATCH_SIZE).map((batch) =>
          upstoxGet<{ data?: Record<string, Record<string, unknown>> }>('/market-quote/quotes', { instrument_key: batch.join(',') }),
        ),
      );

      const rawMap = new Map<string, Record<string, unknown>>();
      for (const payload of payloads) {
        for (const [instrumentKey, value] of Object.entries(payload?.data || {})) {
          rawMap.set(instrumentKey, value as Record<string, unknown>);
        }
      }

      const quotes = normalizedSymbols.map((symbol) => {
        const target = resolved.get(symbol);
        if (!target) return emptyQuote(symbol);
        const raw = rawMap.get(target.instrumentKey);
        return raw ? mapQuote(target, raw) : emptyQuote(symbol, target);
      });

      cset(cacheKey, quotes, 10_000);
      return quotes;
    } catch (e: unknown) {
      const message = getUpstoxErrorMessage(e);
      logger.warn(`Upstox getQuotes: ${message}`);
      throw new Error(message);
    }
  }

  static async getQuote(symbol: string): Promise<Quote | null> {
    const result = await this.getQuotes([symbol]);
    return result[0] || null;
  }

  static async getIndices(): Promise<Index[]> {
    const cacheKey = 'upstox:indices';
    const cached = cget(cacheKey) as Index[] | null;
    if (cached) return cached;

    const indices = (await this.getQuotes(UPSTOX_INDEX_SYMBOLS)).map(toIndex);
    cset(cacheKey, indices, 10_000);
    return indices;
  }

  static async getHistoricalData(
    symbol: string,
    period = '1mo',
  ): Promise<{ date: string; open: number; high: number; low: number; close: number; volume: number }[]> {
    const cacheKey = `upstox:hist:${symbol}:${period}`;
    const cached = cget(cacheKey) as { date: string; open: number; high: number; low: number; close: number; volume: number }[] | null;
    if (cached) return cached;

    const resolved = (await resolveTargets([symbol])).get(normalizeSymbol(symbol));
    if (!resolved?.instrumentKey) return [];

    try {
      const now  = new Date();
      const from = new Date();
      const days: Record<string, number> = { '1d': 1, '5d': 5, '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365 };
      from.setDate(from.getDate() - (days[period] || 30));

      const toStr   = now.toISOString().split('T')[0];
      const fromStr = from.toISOString().split('T')[0];

      const raw = await upstoxGet(
        `/historical-candle/${encodeURIComponent(resolved.instrumentKey)}/1day/${toStr}/${fromStr}`
      ) as { data?: { candles?: (string | number)[][] } } | null;

      const candles = (raw?.data?.candles || []).map((c) => ({
        date:   String(c[0]),
        open:   Number(c[1]),
        high:   Number(c[2]),
        low:    Number(c[3]),
        close:  Number(c[4]),
        volume: Number(c[5]) || 0,
      }));

      cset(cacheKey, candles, 300_000);
      return candles;
    } catch (e: unknown) {
      const message = getUpstoxErrorMessage(e);
      logger.warn(`Upstox getHistoricalData: ${message}`);
      throw new Error(message);
    }
  }

  static async getMarketMovers(type = 'gainers', count = 10): Promise<Quote[]> {
    const buckets = await this.getMarketMoverBuckets();
    if (type === 'losers') return buckets.losers.slice(0, count);
    if (type === 'volume') return buckets.volume.slice(0, count);
    return buckets.gainers.slice(0, count);
  }

  static async getMarketSummary() {
    const [indices, buckets] = await Promise.all([
      this.getIndices(),
      this.getMarketMoverBuckets(),
    ]);
    return {
      indices,
      gainers: buckets.gainers.slice(0, 5),
      losers: buckets.losers.slice(0, 5),
      mostActive: buckets.volume.slice(0, 5),
      lastUpdated: new Date().toISOString(),
      marketStatus: 'REGULAR',
    };
  }

  static async getStocksBySector(sector: string): Promise<Quote[]> {
    const symbols = SECTOR_MAP[sector] || [];
    if (!symbols.length) return [];
    return this.getQuotes(symbols);
  }

  static async getAllSectorsData(): Promise<{ name: string; stocks: Quote[] }[]> {
    const cacheKey = 'upstox:sectors';
    const cached = cget(cacheKey) as { name: string; stocks: Quote[] }[] | null;
    if (cached) return cached;

    const uniqueSymbols = [...new Set(Object.values(SECTOR_MAP).flat())];
    const allQuotes = await this.getQuotes(uniqueSymbols);
    const quoteMap = new Map(allQuotes.map((quote) => [quote.symbol, quote]));

    const sectors = Object.entries(SECTOR_MAP).map(([name, symbols]) => ({
      name,
      stocks: symbols
        .map((symbol) => quoteMap.get(symbol))
        .filter(Boolean) as Quote[],
    }));

    cset(cacheKey, sectors, 20_000);
    return sectors;
  }

  static async getScreenerMetrics(symbols: string[]): Promise<ScreenerMetric[]> {
    const normalizedSymbols = unique(symbols.map(normalizeSymbol)).filter(Boolean);
    const cacheKey = `upstox:analytics:${[...normalizedSymbols].sort().join(',')}`;
    const cached = cget(cacheKey) as ScreenerMetric[] | null;
    if (cached) return cached;

    const [quotes, universeMatches] = await Promise.all([
      this.getQuotes(normalizedSymbols),
      MarketUniverseService.resolveSymbols(normalizedSymbols),
    ]);

    const metrics = quotes.map((quote) => {
      const universe = universeMatches.get(quote.symbol) || universeMatches.get(normalizeSymbol(quote.symbol));
      const stockDefinition = findStockDefinition(quote.symbol);
      return toScreenerMetric(
        quote,
        universe?.sectors?.[0] || stockDefinition?.sectors?.[0] || 'Unknown',
        universe?.industry || universe?.sectors?.[0] || stockDefinition?.sectors?.[0] || 'Unknown',
        Boolean(universe?.inNifty50 || stockDefinition?.inNifty50 || NIFTY_50_STOCKS.includes(quote.symbol as (typeof NIFTY_50_STOCKS)[number])),
      );
    });

    cset(cacheKey, metrics, 20_000);
    return metrics;
  }

  static async primeHotPathCache(): Promise<void> {
    await Promise.allSettled([
      MarketUniverseService.getUniverse(),
      this.getIndices(),
      this.getMarketSummary(),
      this.getAllSectorsData(),
    ]);
  }

  static getNifty50Stocks(): string[] {
    return [...NIFTY_50_STOCKS];
  }

  static getIndicesList() {
    return MARKET_INDICES.map((index) => ({ symbol: index.name, shortName: index.shortName }));
  }
}
