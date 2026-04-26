import { logger } from '../utils/logger.js';
import {
  MARKET_INDICES,
  NIFTY_50_STOCKS,
  getSearchCatalogResults,
} from '../data/marketCatalog.js';
import { MarketUniverseService } from './marketUniverseService.js';
import { YahooFinanceService, getQuotesWithMarketCap } from './yahooFinanceService.js';
import { getAllStocks } from './stockCacheService.js';
import { MARKET_STOCKS_DATA } from '../data/generatedStocks.js';
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
    
    // Deduplicate by symbol first
    const seen = new Set<string>();
    let allQuotes = [...summary.gainers, ...summary.losers, ...summary.mostActive]
      .filter(q => {
        if (seen.has(q.symbol)) return false;
        seen.add(q.symbol);
        return q.price > 0;
      });
    
    // Market Cap thresholds (in INR)
    // Largecap: > ₹20,000 Cr = 200,000,000,000
    // Midcap: ₹2,000 Cr - ₹20,000 Cr = 20,000,000,000
    // Smallcap: < ₹2,000 Cr
    const LARGE_CAP = 200_000_000_000;
    const MID_CAP = 20_000_000_000;
    
    let filtered: Quote[];
    switch (cap) {
      case 'largecap':
        // Market cap > ₹20k Cr
        filtered = allQuotes.filter(q => (q.marketCap || 0) > LARGE_CAP);
        break;
      case 'midcap':
        // Market cap ₹2k Cr - ₹20k Cr
        filtered = allQuotes.filter(q => {
          const mc = q.marketCap || 0;
          return mc > MID_CAP && mc <= LARGE_CAP;
        });
        break;
      case 'smallcap':
        // Market cap < ₹2k Cr
        filtered = allQuotes.filter(q => (q.marketCap || 0) <= MID_CAP);
        break;
      default:
        filtered = allQuotes;
    }
    
    // Use traded value (price * volume) for volume leaders
    const topGainers = [...filtered]
      .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
      .slice(0, 10);
    
    const topLosers = [...filtered]
      .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
      .slice(0, 10);
    
    const topVolume = [...filtered]
      .sort((a, b) => {
        const valueA = (a.price || 0) * (a.volume || 0);
        const valueB = (b.price || 0) * (b.volume || 0);
        return valueB - valueA;
      })
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
      const yahooData = await runProvider('yahoo', () => YahooFinanceService.getHistoricalData(normalizedSymbol, period));
      if (hasUsableHistoricalData(yahooData)) return yahooData;
    } catch {
      // Empty handled below.
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

  // IMPROVED: Increased from 40 to 150 stocks per sector for better coverage
  static async getSectorAnalytics(sector: string, limit = 150): Promise<ScreenerMetric[]> {
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

  static async getAllQuotesWithMarketCap(): Promise<Quote[]> {
    const cachedStocks = await getAllStocks();
    const quotes: Quote[] = cachedStocks.map(s => ({
      symbol: s.symbol,
      name: s.symbol,
      price: s.price,
      change: s.change,
      changePercent: s.changePercent,
      volume: s.volume,
      dayHigh: s.dayHigh,
      dayLow: s.dayLow,
      previousClose: s.previousClose,
      open: s.open,
      high52w: s.high52w,
      low52w: s.low52w,
      marketCap: s.marketCap,
      marketState: s.marketState,
      exchange: s.exchange,
      currency: 'INR',
      timestamp: s.timestamp,
      isStale: false,
    }));
    
    const withPrice = quotes.filter(q => q.price > 0);
    
    if (withPrice.every(q => q.marketCap && q.marketCap > 0)) {
      return withPrice;
    }
    
    try {
      const YahooFinance = (await import('yahoo-finance2')).default;
      const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
      
      const stocksNeedingMc = withPrice.filter(q => !q.marketCap || q.marketCap === 0).slice(0, 50);
      logger.info(`Fetching market cap for ${stocksNeedingMc.length} stocks using yfinance2...`);
      
      const mcapMap = new Map<string, number>();
      
      for (const stock of stocksNeedingMc) {
        try {
          const result = await yf.quoteSummary(stock.symbol + '.NS', { modules: ['summaryDetail'] });
          if (result.summaryDetail?.marketCap) {
            mcapMap.set(stock.symbol, result.summaryDetail.marketCap);
          }
        } catch (e) {
          // Continue to next stock
        }
      }
      
      logger.info(`Got market cap for ${mcapMap.size} stocks`);
      
      return withPrice.map(q => ({
        ...q,
        marketCap: mcapMap.get(q.symbol) || q.marketCap,
      }));
    } catch (error) {
      logger.warn(`getAllQuotesWithMarketCap error: ${(error as Error).message}`);
      return withPrice;
    }
  }

  // IMPROVED: Better market cap thresholds and more comprehensive categorization
  static async getEnhancedMoversByCap(): Promise<{
    largecap: { gainers: Quote[]; losers: Quote[]; volumeLeaders: Quote[] };
    midcap: { gainers: Quote[]; losers: Quote[]; volumeLeaders: Quote[] };
    smallcap: { gainers: Quote[]; losers: Quote[]; volumeLeaders: Quote[] };
  }> {
    // Updated thresholds - more realistic for Indian market
    const LARGE_CAP = 200_000_000_000;  // ₹20,000 Cr
    const MID_CAP   = 20_000_000_000;   // ₹2,000 Cr (changed from 5,000 Cr for better mid-cap coverage)

    const EMPTY = { gainers: [] as Quote[], losers: [] as Quote[], volumeLeaders: [] as Quote[] };

    // ── Load primary source: cached universe ──────────────────────────────
    let allQuotes = await this.getAllQuotesWithMarketCap();

    // ── Supplement with live market summary if cache is thin ──────────────
    if (!allQuotes || allQuotes.length < 100) {
      logger.info(`Enhanced movers: cache thin (${allQuotes?.length || 0} stocks), supplementing from market summary`);
      try {
        const summary = await this.getMarketSummary();
        const summaryQuotes = [...summary.gainers, ...summary.losers, ...summary.mostActive];

        if (allQuotes.length === 0) {
          allQuotes = summaryQuotes;
        } else {
          // Merge, preferring cached data
          const cachedSymbols = new Set(allQuotes.map(q => q.symbol));
          const extra = summaryQuotes.filter(q => !cachedSymbols.has(q.symbol));
          allQuotes = [...allQuotes, ...extra];
        }
      } catch (err) {
        logger.warn(`Enhanced movers supplemental fetch failed: ${(err as Error).message}`);
      }
    }

    if (!allQuotes || allQuotes.length === 0) {
      return { largecap: EMPTY, midcap: EMPTY, smallcap: EMPTY };
    }

    logger.info(`Enhanced movers: processing ${allQuotes.length} total stocks from universe`);

    // ── Categorise stocks ────────────────────────────────────────────────
    const categorize = (quotes: Quote[]) => {
      if (!quotes || quotes.length === 0) return EMPTY;
      const valid = quotes.filter(q => q.price > 0 && q.changePercent !== undefined);
      return {
        gainers:       [...valid].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0)).slice(0, 25),
        losers:        [...valid].sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0)).slice(0, 25),
        volumeLeaders: [...valid].sort((a, b) => ((b.price * b.volume) || 0) - ((a.price * a.volume) || 0)).slice(0, 25),
      };
    };

    const hasMarketCapData = allQuotes.some(q => (q.marketCap || 0) > 0);

    if (hasMarketCapData) {
      const largecapQ  = allQuotes.filter(q => (q.marketCap || 0) >= LARGE_CAP);
      const midcapQ    = allQuotes.filter(q => { const mc = q.marketCap || 0; return mc >= MID_CAP && mc < LARGE_CAP; });
      const smallcapQ  = allQuotes.filter(q => (q.marketCap || 0) < MID_CAP && (q.marketCap || 0) > 0);

      logger.info(`Enhanced movers: largecap=${largecapQ.length}, midcap=${midcapQ.length}, smallcap=${smallcapQ.length}`);

      // If we have good categorization, use it directly
      if (largecapQ.length >= 10 && midcapQ.length >= 10 && smallcapQ.length >= 10) {
        return {
          largecap: categorize(largecapQ),
          midcap:   categorize(midcapQ),
          smallcap: categorize(smallcapQ),
        };
      }

      // Otherwise use a hybrid approach
      return {
        largecap: categorize(largecapQ.length >= 10 ? largecapQ : allQuotes.filter(q => (q.price || 0) >= 1000)),
        midcap:   categorize(midcapQ.length   >= 10 ? midcapQ   : allQuotes.filter(q => { const p = q.price || 0; return p >= 200 && p < 1000; })),
        smallcap: categorize(smallcapQ.length >= 10 ? smallcapQ : allQuotes.filter(q => (q.price || 0) < 200)),
      };
    }

    // ── Fallback: price-based segmentation ───────────────────────────────
    logger.info('Enhanced movers: no market cap data, using price-based segmentation');
    return {
      largecap: categorize(allQuotes.filter(q => (q.price || 0) >= 1000)),
      midcap:   categorize(allQuotes.filter(q => { const p = q.price || 0; return p >= 200 && p < 1000; })),
      smallcap: categorize(allQuotes.filter(q => (q.price || 0) < 200)),
    };
  }
}