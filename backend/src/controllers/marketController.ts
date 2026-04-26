import { Request, Response } from 'express';
import { MarketDataService } from '../services/marketDataService.js';
import { NewsService }         from '../services/news.js';
import { MarketInsightsService } from '../services/marketInsightsService.js';
import { RadarEngineService } from '../services/radarEngineService.js';
import { asyncHandler, AppError } from '../utils/helpers.js';
import {
  getPublicMarketCatalog,
  MARKET_INDICES,
  NIFTY_50_STOCKS,
  SECTOR_MAP,
} from '../data/marketCatalog.js';

// Set aggressive caching headers for market data
function setCacheHeaders(res: Response, maxAge = 15, swr = 60) {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`);
}

export const marketController = {

  getIndices: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 15);
    const data = await MarketDataService.getIndices();
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getMarketSummary: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 20);
    const data = await MarketDataService.getMarketSummary();
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getTodayDesk: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 30, 90);
    const data = await MarketInsightsService.getTodayDesk();
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getSectorPerformance: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 30);
    const indices = await MarketDataService.getIndices();
    const sectors = (indices || []).map(idx => ({
      name: idx.symbol, price: idx.price, change: idx.change,
      changePercent: idx.changePercent, marketState: idx.marketState,
    }));
    res.json({ success: true, data: sectors, timestamp: new Date().toISOString() });
  }),

  getAllSectorsData: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 30, 120);
    const data = await MarketDataService.getAllSectorsData();
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getStocksBySector: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 30);
    const { sector } = req.params;
    const data = await MarketDataService.getStocksBySector(sector);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getSectorAnalytics: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 60, 180);
    const { sector } = req.params;
    const { limit = '40' } = req.query;
    const data = await MarketDataService.getSectorAnalytics(sector, parseInt(limit as string, 10));
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getMarketMovers: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 30);
    const { type = 'gainers', count = '10' } = req.query;
    const data = await MarketDataService.getMarketMovers(type as string, parseInt(count as string, 10));
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getMoversByCap: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 30);
    const { cap = 'all' } = req.query;
    const data = await MarketDataService.getMoversByCap(cap as string);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getEnhancedMovers: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 30);
    const data = await MarketDataService.getEnhancedMoversByCap();
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getQuotes: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 15);
    const { symbols } = req.query;
    if (!symbols) throw new AppError('symbols query param required', 400);

    const symbolList = (symbols as string).split(',').map(s => s.trim()).filter(Boolean);
    if (symbolList.length === 0) throw new AppError('No valid symbols', 400);
    if (symbolList.length > 50) throw new AppError('Max 50 symbols per request', 400);

    const data = await MarketDataService.getQuotes(symbolList);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getQuote: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 15);
    const { symbol } = req.params;
    const data = await MarketDataService.getQuote(symbol);
    if (!data || data.price === 0) throw new AppError('Symbol not found or no data', 404);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  searchStocks: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 60);
    const { q } = req.query;
    if (!q || (q as string).length < 1) throw new AppError('q param required (min 1 char)', 400);
    const data = await MarketDataService.searchStocks(q as string);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getAnalytics: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 300, 600);
    const { symbols } = req.query;
    if (!symbols) throw new AppError('symbols query param required', 400);
    const symbolList = (symbols as string).split(',').map(s => s.trim()).filter(Boolean);
    const data = await MarketDataService.getAnalytics(symbolList);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getOpportunityRadar: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 45, 120);
    const { mode = 'momentum', horizon = 'intraday', selectivity = 'balanced' } = req.query;
    const data = await MarketInsightsService.getOpportunityRadar(
      mode as 'momentum' | 'breakout' | 'pullback' | 'avoid' | 'sympathy' | 'guided',
      horizon as 'intraday' | 'swing',
      selectivity as 'conservative' | 'balanced' | 'aggressive',
    );
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  /** Radar page — pure signal snapshot (breakouts, RSI, volume spikes) */
  getRadarSnapshot: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 20, 60);
    const { limit = '40' } = req.query;
    const data = await RadarEngineService.getSnapshot(parseInt(limit as string, 10));
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  /** Radar page — support/resistance for a specific symbol */
  getSignalSupportResistance: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 300, 900);
    const { symbol } = req.params;
    const data = await RadarEngineService.getSupportResistance(symbol);
    if (!data) throw new AppError('Support/resistance data unavailable for this symbol', 404);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getGuidedScreener: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 60, 150);
    const {
      playbook = 'leadership',
      horizon = 'swing',
      selectivity = 'balanced',
      sortBy = 'score',
      sector = 'all',
      minPrice,
      maxPrice,
      minMomentumScore,
      minVolumeRatio,
      maxRsi14,
      minWeek52RangePosition,
      maxDistanceFromHigh52,
      maxPeRatio,
      maxPriceToBook,
      minRevenueGrowth,
      minProfitMargins,
    } = req.query;
    const data = await MarketInsightsService.getGuidedScreener(
      playbook as 'leadership' | 'quality' | 'pullback' | 'sympathy' | 'avoid',
      horizon as 'intraday' | 'swing',
      selectivity as 'conservative' | 'balanced' | 'aggressive',
      sortBy as 'score' | 'momentum' | 'volume' | 'breakout' | 'sector' | 'value',
      sector as string,
      {
        minPrice,
        maxPrice,
        minMomentumScore,
        minVolumeRatio,
        maxRsi14,
        minWeek52RangePosition,
        maxDistanceFromHigh52,
        maxPeRatio,
        maxPriceToBook,
        minRevenueGrowth,
        minProfitMargins,
      },
    );
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getFundamentals: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 300, 600);
    const { symbols } = req.query;
    if (!symbols) throw new AppError('symbols query param required', 400);
    const symbolList = (symbols as string).split(',').map(s => s.trim()).filter(Boolean);
    const data = await MarketDataService.getAnalytics(symbolList);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getHistorical: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 300, 900);
    const { symbol } = req.params;
    const { period = '1mo' } = req.query;
    const validPeriods = ['5m', '15m', '30m', '1h', '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'];
    if (!validPeriods.includes(period as string))
      throw new AppError(`Invalid period. Use: ${validPeriods.join(', ')}`, 400);

    const resolvedPeriod = period === 'max' ? '10y' : (period as string);
    const data = await MarketDataService.getHistoricalData(symbol, resolvedPeriod);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getStockResearch: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 300, 900);
    const { symbol } = req.params;
    const [research, story] = await Promise.all([
      MarketDataService.getStockResearch(symbol),
      MarketInsightsService.getStockStory(symbol),
    ]);
    const data = research ? { ...research, story } : null;
    if (!data) throw new AppError('Symbol not found or no research data available', 404);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getStockStory: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 180, 600);
    const { symbol } = req.params;
    const data = await MarketInsightsService.getStockStory(symbol);
    if (!data) throw new AppError('Stock story unavailable for the selected symbol', 404);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  getNiftyStocks: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 3600);
    res.json({ success: true, data: [...NIFTY_50_STOCKS] });
  }),

  getSectorMap: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 3600);
    res.json({ success: true, data: SECTOR_MAP });
  }),

  getIndicesList: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 3600);
    res.json({
      success: true,
      data: MARKET_INDICES.map((index) => ({ symbol: index.name, shortName: index.shortName })),
    });
  }),

  getCatalog: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 3600, 7200);
    res.json({ success: true, data: getPublicMarketCatalog(), timestamp: new Date().toISOString() });
  }),

  getPrimaryWatchlist: asyncHandler(async (_req: Request, res: Response) => {
    setCacheHeaders(res, 3600, 7200);
    const { MarketDataService } = await import('../services/marketDataService.js');
    const { config } = await import('../config/index.js');
    const axios = (await import('axios')).default;

    const today = new Date().toISOString().split('T')[0];
    const summary = await MarketDataService.getMarketSummary();
    const gainers = summary?.gainers || [];
    const losers = summary?.losers || [];
    const mostActive = summary?.mostActive || [];

    const largeCapCandidates = [...gainers, ...losers]
      .filter(s => s.marketCap > 2000000000000)
      .slice(0, 20);
    const midCapCandidates = [...gainers, ...losers]
      .filter(s => s.marketCap > 50000000000 && s.marketCap <= 2000000000000)
      .slice(0, 15);
    const smallCapCandidates = [...gainers, ...losers, ...mostActive]
      .filter(s => s.marketCap <= 50000000000)
      .slice(0, 15);

    const largeCapSymbols = largeCapCandidates.slice(0, 8).map(s => s.symbol);
    const midCapSymbols = midCapCandidates.slice(0, 6).map(s => s.symbol);
    const smallCapSymbols = smallCapCandidates.slice(0, 6).map(s => s.symbol);

    const allCandidates = [...largeCapSymbols, ...midCapSymbols, ...smallCapSymbols];
    const quotes = await MarketDataService.getQuotes(allCandidates);

    const stockData = quotes.map(q => ({
      symbol: q.symbol,
      name: q.name,
      price: q.price,
      changePercent: q.changePercent,
      marketCap: q.marketCap,
      volume: q.volume,
      exchange: q.exchange,
    }));

    let primaryStocks: { symbol: string; name: string }[] = [
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd' },
      { symbol: 'TCS', name: 'Tata Consultancy Services Ltd' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd' },
      { symbol: 'INFY', name: 'Infosys Ltd' },
      { symbol: 'AXISBANK', name: 'Axis Bank Ltd' },
      { symbol: 'SBIN', name: 'State Bank of India' },
      { symbol: 'IRCTC', name: 'IRCTC Ltd' },
      { symbol: 'COFORGE', name: 'Coforge Ltd' },
      { symbol: 'ADANIENSOL', name: 'Adani Energy Solutions Ltd' },
      { name: 'Delhivery Ltd', symbol: 'DELHIVERY' },
    ];

    if (config.ai.enabled && stockData.length > 0) {
      try {
        const prompt = {
          date: today,
          marketData: stockData.slice(0, 20).map(s => ({
            symbol: s.symbol,
            name: s.name,
            price: s.price,
            change: s.changePercent,
            mcap: s.marketCap,
            volume: s.volume,
          })),
        };

        const response = await axios.post(
          `${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`,
          {
            model: config.ai.model,
            temperature: 0.3,
            ...(config.ai.provider === 'groq' ? { response_format: { type: 'json_object' } } : {}),
            messages: [
              {
                role: 'system',
                content: 'You are a professional Indian stock market analyst. Select 10 prominent stocks for a primary watchlist based on current market performance. Return JSON only. No markdown.',
              },
              {
                role: 'user',
                content: `Select exactly 10 stocks for a primary watchlist: 4 large caps (market cap > ₹2T), 3 midcaps (₹50B-₹2T), 3 small caps (< ₹50B). Use today\'s market performance data to pick those with recent momentum, liquidity, and market presence. Return JSON array with objects: [{"symbol":"string","name":"string","category":"largecap|midcap|smallcap"}]. Market data: ${JSON.stringify(prompt)}`,
              },
            ],
          },
          {
            timeout: config.ai.timeoutMs,
            headers: {
              Authorization: `Bearer ${config.ai.apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length >= 7) {
              primaryStocks = parsed.slice(0, 10).map((s: { symbol: string; name: string }) => ({
                symbol: s.symbol?.toUpperCase() || '',
                name: s.name || s.symbol,
              })).filter((s: { symbol: string }) => s.symbol);
            }
          } catch {
          }
        }
      } catch (aiError) {
      }
    }

    const finalStocks = primaryStocks.slice(0, 10).filter(s => s.symbol);
    res.json({ success: true, data: finalStocks, timestamp: new Date().toISOString() });
  }),

  getNews: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 120, 300);
    const { filter = 'all', category, limit = '20' } = req.query;
    const data = await NewsService.getCuratedNews(
      filter as string,
      category as string | undefined,
      parseInt(limit as string, 10),
    );
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  }),

  runScreenerFilters: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 30);
    const { filters, query, symbols } = req.body;
    
    let stockSymbols: string[] = symbols;
    if (!stockSymbols || stockSymbols.length === 0) {
      stockSymbols = [...NIFTY_50_STOCKS];
    }
    
    const quotes = await MarketDataService.getQuotes(stockSymbols);
    
    let results = [...quotes];
    
    if (filters && filters.length > 0) {
      const enabledFilters = filters.filter((f: { enabled: boolean }) => f.enabled);
      
      for (const filter of enabledFilters) {
        const { metric, operator, value } = filter as { metric: string; operator: string; value: string };
        const filterValue = parseFloat(value);
        
        if (!isNaN(filterValue)) {
          results = results.filter(q => {
            const stockValue = (q as unknown as Record<string, unknown>)[metric] as number | undefined;
            if (stockValue === undefined || stockValue === null) return true;
            
            switch (operator) {
              case '>': return stockValue > filterValue;
              case '<': return stockValue < filterValue;
              case '>=': return stockValue >= filterValue;
              case '<=': return stockValue <= filterValue;
              case '=': return stockValue === filterValue;
              default: return true;
            }
          });
        }
      }
    }
    
    if (query && query.trim()) {
      const terms = query.toLowerCase().split(/\s+and\s+|\s+or\s+/i);
      results = results.filter(q => {
        const searchText = `${q.symbol} ${q.name}`.toLowerCase();
        return terms.every((term: string) => searchText.includes(term.trim()));
      });
    }
    
    res.json({ success: true, data: results.slice(0, 100), timestamp: new Date().toISOString() });
  }),
};
