import { logger } from '../utils/logger.js';
import {
  MARKET_INDICES,
  getSearchCatalogResults,
} from '../data/marketCatalog.js';
import { MarketUniverseService } from './marketUniverseService.js';
import { YahooFinanceService } from './yahooFinanceService.js';
import type { Index, Quote, ScreenerMetric, StockResearch } from './marketTypes.js';

type ProviderName = 'yahoo';

interface ProviderHealthState {
  ok: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

const providerHealth: Record<ProviderName, ProviderHealthState> = {
  yahoo: {
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
    rawSymbol: def.yahooSymbol,
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
      const indices = await runProvider('yahoo', () => YahooFinanceService.getIndices());
      if (hasUsableQuotes(indices)) return indices;
    } catch {
      // Fallback handled below.
    }

    return MARKET_INDICES.map((def) => emptyIndex(def));
  }

  static async getQuote(symbol: string): Promise<Quote | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    try {
      const yahooQuote = await runProvider('yahoo', () => YahooFinanceService.getQuote(normalizedSymbol));
      if (isUsableQuote(yahooQuote)) return yahooQuote;
    } catch {
      // Null handled below.
    }

    return null;
  }

  static async getQuotes(symbols: string[]): Promise<Quote[]> {
    const normalizedSymbols = symbols.map((symbol) => symbol.trim().toUpperCase());

    try {
      const yahooQuotes = await runProvider('yahoo', () => YahooFinanceService.getQuotes(normalizedSymbols));
      if (Array.isArray(yahooQuotes) && yahooQuotes.length) {
        return normalizedSymbols.map((symbol) => yahooQuotes.find((quote) => quote.symbol.toUpperCase() === symbol) || emptyQuote(symbol));
      }
    } catch {
      // Fallback handled below.
    }

    return normalizedSymbols.map((symbol) => emptyQuote(symbol));
  }

  static async getMarketMovers(type = 'gainers', count = 10): Promise<Quote[]> {
    try {
      const yahooMovers = await runProvider('yahoo', () => YahooFinanceService.getMarketMovers(type, count));
      if (hasUsableQuotes(yahooMovers)) return yahooMovers;
    } catch {
      // Default below.
    }

    return [];
  }

  static async getMoversByCap(cap: string): Promise<{ gainers: Quote[]; losers: Quote[]; volumeLeaders: Quote[] }> {
    const summary = await this.getMarketSummary();
    
    let allQuotes = [...summary.gainers, ...summary.losers, ...summary.mostActive]
      .filter(q => q.price > 0);
    
    const LARGE_PRICE = 500;
    const MID_PRICE = 100;
    
    let filtered: Quote[];
    switch (cap) {
      case 'largecap':
        filtered = allQuotes.filter(q => q.price >= LARGE_PRICE);
        break;
      case 'midcap':
        filtered = allQuotes.filter(q => q.price >= MID_PRICE && q.price < LARGE_PRICE);
        break;
      case 'smallcap':
        filtered = allQuotes.filter(q => q.price < MID_PRICE);
        break;
      default:
        filtered = allQuotes;
    }
    
    if (filtered.length < 10) {
      filtered = allQuotes;
    }
    
    const topGainers = [...filtered]
      .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
      .slice(0, 10);
    
    const topLosers = [...filtered]
      .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
      .slice(0, 10);
    
    const topVolume = [...filtered]
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 10);
    
    return {
      gainers: topGainers,
      losers: topLosers,
      volumeLeaders: topVolume,
    };
  }

  static async getHistoricalData(symbol: string, period = '1mo') {
    const normalizedSymbol = symbol.trim().toUpperCase();

    try {
      const yahooBars = await runProvider('yahoo', () =>
        YahooFinanceService.getHistoricalData(normalizedSymbol, period),
      );
      if (hasUsableHistoricalData(yahooBars as Array<{ close: number }>)) return yahooBars;
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
      return await runProvider('yahoo', () => YahooFinanceService.getScreenerMetrics(symbols));
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
      const sectorStocks = await runProvider('yahoo', () => YahooFinanceService.getStocksBySector(sector));
      if (Array.isArray(sectorStocks)) return sectorStocks;
    } catch {
      // Empty fallback below.
    }

    return [];
  }

  static async getSectorAnalytics(sector: string, limit = 40): Promise<ScreenerMetric[]> {
    try {
      const stocks = await MarketUniverseService.getStocksBySector(sector, limit);
      if (!stocks.length) return [];
      return await runProvider('yahoo', () => YahooFinanceService.getScreenerMetrics(stocks.map((stock) => stock.symbol)));
    } catch (error) {
      logger.warn(`MarketDataService getSectorAnalytics error: ${(error as Error).message}`);
      return [];
    }
  }

  static async getAllSectorsData() {
    try {
      const yahooData = await runProvider('yahoo', () => YahooFinanceService.getAllSectorsData());
      if (Array.isArray(yahooData)) return yahooData;
    } catch {
      // Empty fallback below.
    }

    return [];
  }

  static async getStockResearch(symbol: string): Promise<StockResearch | null> {
    try {
      return await runProvider('yahoo', () => YahooFinanceService.getStockResearch(symbol));
    } catch (error) {
      logger.warn(`MarketDataService getStockResearch error: ${(error as Error).message}`);
      return null;
    }
  }

  static async getMarketSummary() {
    try {
      const yahooSummary = await runProvider('yahoo', () => YahooFinanceService.getMarketSummary());
      if (hasUsableQuotes(yahooSummary.indices) || hasUsableQuotes(yahooSummary.gainers)) {
        return {
          indices: yahooSummary.indices,
          gainers: yahooSummary.gainers,
          losers: yahooSummary.losers,
          mostActive: yahooSummary.mostActive,
          lastUpdated: yahooSummary.lastUpdated || isoNow(),
          marketStatus: yahooSummary.indices.find((index) => isUsableQuote(index))?.marketState || 'CLOSED',
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
      YahooFinanceService.primeHotPathCache(),
    ]);
  }
}