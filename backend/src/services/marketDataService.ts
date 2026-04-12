import { logger } from '../utils/logger.js';
import {
  MARKET_INDICES,
  getSearchCatalogResults,
} from '../data/marketCatalog.js';
import { MarketUniverseService } from './marketUniverseService.js';
import { UpstoxService } from './upstoxService.js';
import type { Index, Quote, ScreenerMetric } from './marketTypes.js';

type ProviderName = 'upstox';

interface ProviderHealthState {
  ok: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

const providerHealth: Record<ProviderName, ProviderHealthState> = {
  upstox: {
    ok: true,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
  },
};

function isoNow(): string {
  return new Date().toISOString();
}

function markProviderSuccess(provider: ProviderName) {
  const now = isoNow();
  providerHealth[provider] = {
    ok: true,
    lastAttemptAt: now,
    lastSuccessAt: now,
    lastError: null,
  };
}

function markProviderFailure(provider: ProviderName, reason: string) {
  providerHealth[provider] = {
    ...providerHealth[provider],
    ok: false,
    lastAttemptAt: isoNow(),
    lastError: reason,
  };
}

function isUsableQuote(quote: Quote | Index | null | undefined): boolean {
  return Boolean(quote && quote.price > 0);
}

function hasUsableQuotes(quotes: Array<Quote | Index> | null | undefined): boolean {
  return Array.isArray(quotes) && quotes.some(isUsableQuote);
}

function hasUsableHistoricalData(
  bars: Array<{ close: number }> | null | undefined,
): boolean {
  return Array.isArray(bars) && bars.some((bar) => Number(bar?.close) > 0);
}

function emptyQuote(symbol: string): Quote {
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
    timestamp: isoNow(),
    isStale: false,
  };
}

function emptyIndex(def: typeof MARKET_INDICES[number]): Index {
  return {
    symbol: def.name,
    shortName: def.shortName,
    rawSymbol: def.upstoxSymbol,
    exchange: 'NSE',
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    previousClose: 0,
    dayHigh: 0,
    dayLow: 0,
    marketState: 'CLOSED',
    timestamp: isoNow(),
    isStale: false,
  };
}

async function runProvider<T>(provider: ProviderName, loader: () => Promise<T>): Promise<T> {
  try {
    const data = await loader();
    markProviderSuccess(provider);
    return data;
  } catch (error) {
    const message = (error as Error).message;
    markProviderFailure(provider, message);
    throw error;
  }
}

export class MarketDataService {
  static getProviderHealth() {
    return { ...providerHealth };
  }

  static async getIndices(): Promise<Index[]> {
    try {
      const indices = await runProvider('upstox', () => UpstoxService.getIndices());
      if (hasUsableQuotes(indices)) return indices;
    } catch {
      // Fallback handled below.
    }

    return MARKET_INDICES.map((def) => emptyIndex(def));
  }

  static async getQuote(symbol: string): Promise<Quote | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    try {
      const upstoxQuote = await runProvider('upstox', () => UpstoxService.getQuote(normalizedSymbol));
      if (isUsableQuote(upstoxQuote)) return upstoxQuote;
    } catch {
      // Null handled below.
    }

    return null;
  }

  static async getQuotes(symbols: string[]): Promise<Quote[]> {
    const normalizedSymbols = symbols.map((symbol) => symbol.trim().toUpperCase());

    try {
      const upstoxQuotes = await runProvider('upstox', () => UpstoxService.getQuotes(normalizedSymbols));
      if (Array.isArray(upstoxQuotes) && upstoxQuotes.length) {
        return normalizedSymbols.map((symbol) => upstoxQuotes.find((quote) => quote.symbol.toUpperCase() === symbol) || emptyQuote(symbol));
      }
    } catch {
      // Fallback handled below.
    }

    return normalizedSymbols.map((symbol) => emptyQuote(symbol));
  }

  static async getMarketMovers(type = 'gainers', count = 10): Promise<Quote[]> {
    try {
      const upstoxMovers = await runProvider('upstox', () => UpstoxService.getMarketMovers(type, count));
      if (hasUsableQuotes(upstoxMovers)) return upstoxMovers;
    } catch {
      // Default below.
    }

    return [];
  }

  static async getHistoricalData(symbol: string, period = '1mo') {
    const normalizedSymbol = symbol.trim().toUpperCase();

    try {
      const upstoxBars = await runProvider('upstox', () =>
        UpstoxService.getHistoricalData(normalizedSymbol, period),
      );
      if (hasUsableHistoricalData(upstoxBars as Array<{ close: number }>)) return upstoxBars;
    } catch {
      // Empty array below.
    }

    return [];
  }

  static async searchStocks(query: string) {
    try {
      const universeResults = await MarketUniverseService.searchStocks(query, 20);
      if (Array.isArray(universeResults) && universeResults.length > 0) return universeResults;
    } catch {
      logger.warn('MarketDataService search falling back to static catalog');
    }

    const catalogResults = getSearchCatalogResults(query, 20);
    if (catalogResults.length > 0) return catalogResults;

    if (/^[A-Za-z&-]{2,20}$/.test(query.trim())) {
      const quote = await this.getQuote(query);
      if (quote && quote.price > 0) {
        return [{ symbol: quote.symbol, name: quote.name, exchange: quote.exchange, type: 'EQUITY' }];
      }
    }

    return [];
  }

  static async getAnalytics(symbols: string[]): Promise<ScreenerMetric[]> {
    try {
      return await runProvider('upstox', () => UpstoxService.getScreenerMetrics(symbols));
    } catch (error) {
      logger.warn(`MarketDataService getAnalytics error: ${(error as Error).message}`);
      return [];
    }
  }

  static async getFundamentals(symbols: string[]) {
    return this.getAnalytics(symbols);
  }

  static async getStocksBySector(sector: string): Promise<Quote[]> {
    try {
      const sectorStocks = await runProvider('upstox', () => UpstoxService.getStocksBySector(sector));
      if (Array.isArray(sectorStocks)) return sectorStocks;
    } catch {
      // Empty fallback below.
    }

    return [];
  }

  static async getAllSectorsData() {
    try {
      const upstoxData = await runProvider('upstox', () => UpstoxService.getAllSectorsData());
      if (Array.isArray(upstoxData)) return upstoxData;
    } catch {
      // Empty fallback below.
    }

    return [];
  }

  static async getMarketSummary() {
    try {
      const upstoxSummary = await runProvider('upstox', () => UpstoxService.getMarketSummary());
      if (hasUsableQuotes(upstoxSummary.indices) || hasUsableQuotes(upstoxSummary.gainers)) {
        return {
          indices: upstoxSummary.indices,
          gainers: upstoxSummary.gainers,
          losers: upstoxSummary.losers,
          mostActive: upstoxSummary.mostActive,
          lastUpdated: upstoxSummary.lastUpdated || isoNow(),
          marketStatus: upstoxSummary.indices.find((index) => isUsableQuote(index))?.marketState || 'CLOSED',
        };
      }
    } catch {
      // Empty fallback below.
    }

    return {
      indices: MARKET_INDICES.map((definition) => emptyIndex(definition)),
      gainers: [],
      losers: [],
      mostActive: [],
      lastUpdated: isoNow(),
      marketStatus: 'CLOSED',
    };
  }

  static async primeHotPathCache(): Promise<void> {
    await Promise.allSettled([
      MarketUniverseService.getUniverse(),
      UpstoxService.primeHotPathCache(),
    ]);
  }
}