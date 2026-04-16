import axios from 'axios';
import { logger } from '../utils/logger.js';
import type { ChartBar, Fundamentals, MarketDataProvider, NewsItem } from './index.js';

const http = axios.create({
  baseURL: 'https://query2.finance.yahoo.com',
  timeout: 12_000,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
});

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
}

interface YahooSparkResponse {
  spark?: {
    result?: Array<{ symbol?: string; response?: YahooSparkResponseItem[] }>;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}

interface YahooTarget {
  symbol: string;
  name: string;
  yahooSymbol: string;
}

const QUOTE_BATCH_SIZE = 20;

function resolveSymbol(symbol: string): YahooTarget {
  const normalized = symbol.trim().toUpperCase();
  let yahooSymbol = normalized;
  if (!normalized.startsWith('^') && !normalized.endsWith('.NS') && !normalized.endsWith('.BO')) {
    yahooSymbol = `${normalized}.NS`;
  }
  return { symbol: normalized, name: normalized, yahooSymbol };
}

function getHistoryParams(period: string): { range: string; interval: string } {
  switch (period) {
    case '15m': return { range: '1d', interval: '15m' };
    case '1d': return { range: '1d', interval: '5m' };
    case '5d': return { range: '5d', interval: '15m' };
    case '1mo': return { range: '1mo', interval: '1d' };
    case '3mo': return { range: '3mo', interval: '1d' };
    case '6mo': return { range: '6mo', interval: '1d' };
    case '1y': return { range: '1y', interval: '1d' };
    case '2y': return { range: '2y', interval: '1d' };
    case '5y': return { range: '5y', interval: '1wk' };
    case '10y': return { range: '10y', interval: '1mo' };
    default: return { range: '3mo', interval: '1d' };
  }
}

function emptyQuote(symbol: string) {
  return {
    symbol,
    name: symbol,
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
    exchange: 'NSE',
    timestamp: new Date().toISOString(),
    isStale: true,
  };
}

function buildQuote(target: YahooTarget, meta?: YahooSparkMeta) {
  const price = Number(meta?.regularMarketPrice || 0);
  const previousClose = Number(meta?.previousClose || meta?.chartPreviousClose || 0);
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
    open: previousClose || price,
    high52w: Number(meta?.fiftyTwoWeekHigh || 0),
    low52w: Number(meta?.fiftyTwoWeekLow || 0),
    marketCap: 0,
    currency: meta?.currency || 'INR',
    marketState: 'REGULAR',
    exchange: 'NSE',
    timestamp: meta?.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
    isStale: false,
  };
}

export class YahooProvider implements MarketDataProvider {
  private cache = new Map<string, { data: unknown; expiresAt: number }>();

  private async fetchQuotes(symbols: string[]): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    const targets = symbols.map(resolveSymbol);

    for (let i = 0; i < targets.length; i += QUOTE_BATCH_SIZE) {
      const batch = targets.slice(i, i + QUOTE_BATCH_SIZE);
      try {
        const response = await http.get<YahooSparkResponse>('/v7/finance/spark', {
          params: {
            symbols: batch.map(t => t.yahooSymbol).join(','),
            range: '1d',
            interval: '5m',
            indicators: 'close',
            includePrePost: false,
          },
        });

        const rawResults = response.data.spark?.result || [];
        for (const result of rawResults) {
          const sym = result.symbol || result.response?.[0]?.meta?.symbol;
          const payload = result.response?.[0];
          if (!sym) continue;
          const target = resolveTargetFromYahoo(sym);
          results.set(sym.toUpperCase(), buildQuote(target, payload?.meta));
        }
      } catch (error) {
        logger.warn(`Yahoo quote batch failed: ${(error as Error).message}`);
      }
    }

    return results;
  }

  async getQuote(symbol: string): Promise<ReturnType<typeof buildQuote> | null> {
    const target = resolveSymbol(symbol);
    const cached = this.cache.get(`quote:${target.yahooSymbol}`);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as ReturnType<typeof buildQuote>;
    }

    try {
      const response = await http.get<YahooSparkResponse>('/v7/finance/spark', {
        params: {
          symbols: target.yahooSymbol,
          range: '1d',
          interval: '5m',
        },
      });

      const result = response.data.spark?.result?.[0];
      const quote = buildQuote(target, result?.response?.[0]?.meta);
      this.cache.set(`quote:${target.yahooSymbol}`, { data: quote, expiresAt: Date.now() + 60_000 });
      return quote;
    } catch (error) {
      logger.warn(`Yahoo getQuote failed for ${symbol}: ${(error as Error).message}`);
      return emptyQuote(symbol);
    }
  }

  async getChart(symbol: string, period: string = '1mo'): Promise<ChartBar[]> {
    const target = resolveSymbol(symbol);
    const cached = this.cache.get(`chart:${target.yahooSymbol}:${period}`);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as ChartBar[];
    }

    const { range, interval } = getHistoryParams(period);
    try {
      const response = await http.get<YahooChartResponse>(`/v8/finance/chart/${encodeURIComponent(target.yahooSymbol)}`, {
        params: { range, interval, includePrePost: false, events: 'div,splits' },
      });

      const chart = response.data.chart?.result?.[0];
      const quote = chart?.indicators?.quote?.[0];
      const timestamps = chart?.timestamp || [];

      const bars = timestamps.map((timestamp, index) => ({
        date: new Date(timestamp * 1000).toISOString(),
        open: Number(quote?.open?.[index] || 0),
        high: Number(quote?.high?.[index] || 0),
        low: Number(quote?.low?.[index] || 0),
        close: Number(quote?.close?.[index] || 0),
        volume: Number(quote?.volume?.[index] || 0),
      })).filter(bar => bar.close > 0);

      this.cache.set(`chart:${target.yahooSymbol}:${period}`, { data: bars, expiresAt: Date.now() + 120_000 });
      return bars;
    } catch (error) {
      logger.warn(`Yahoo getChart failed for ${symbol}: ${(error as Error).message}`);
      return [];
    }
  }

  async getFundamentals(_symbol: string): Promise<Fundamentals | null> {
    return {
      sector: 'Unclassified',
      industry: 'Equity',
      peRatio: null,
      forwardPe: null,
      priceToBook: null,
      dividendYield: null,
      beta: null,
      revenueGrowth: null,
      profitMargins: null,
      targetMeanPrice: null,
    };
  }

  async getNews(_symbol?: string): Promise<NewsItem[]> {
    return [];
  }
}

function resolveTargetFromYahoo(yahooSymbol: string): YahooTarget {
  const normalized = yahooSymbol.replace(/\.(NS|BO)$/i, '');
  return { symbol: normalized, name: normalized, yahooSymbol };
}

export const yahooProvider = new YahooProvider();
