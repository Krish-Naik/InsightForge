import { Request, Response } from 'express';
import { MarketDataService } from '../services/marketDataService.js';
import { NewsService }         from '../services/news.js';
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

  getMarketMovers: asyncHandler(async (req: Request, res: Response) => {
    setCacheHeaders(res, 30);
    const { type = 'gainers', count = '10' } = req.query;
    const data = await MarketDataService.getMarketMovers(type as string, parseInt(count as string, 10));
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
    const validPeriods = ['1d', '5d', '1mo', '3mo', '6mo', '1y'];
    if (!validPeriods.includes(period as string))
      throw new AppError(`Invalid period. Use: ${validPeriods.join(', ')}`, 400);

    const data = await MarketDataService.getHistoricalData(symbol, period as string);
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
};
