import { Router, Request, Response } from 'express';
import { getStockData, getMultipleStocks, getScannerCache, getIndexData, getMultipleIndices, getCacheStats } from '../services/stockCacheService.js';
import { redisClient } from '../services/redisService.js';
import { YahooFinanceService } from '../services/yahooFinanceService.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/cache-stats', async (_req: Request, res: Response) => {
  const redisHealth = redisClient.healthCheck();
  const cacheStats = await getCacheStats();
  
  res.json({
    redis: redisHealth,
    cache: cacheStats,
    timestamp: new Date().toISOString(),
  });
});

router.get('/quote/:symbol', async (req: Request, res: Response) => {
  const { symbol } = req.params;
  
  const cached = await getStockData(symbol);
  if (cached) {
    logger.debug(`Cache hit for ${symbol}`);
    return res.json({
      source: 'cache',
      data: cached,
    });
  }
  
  try {
    const quote = await YahooFinanceService.getQuote(symbol);
    if (!quote) {
      return res.status(404).json({ error: 'Symbol not found' });
    }
    
    return res.json({
      source: 'api',
      data: quote,
    });
  } catch (error) {
    logger.error(`Failed to fetch quote for ${symbol}: ${(error as Error).message}`);
    return res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

router.get('/quotes', async (req: Request, res: Response) => {
  const symbols = (req.query.symbols as string)?.split(',').map(s => s.trim()).filter(Boolean) || [];
  
  if (symbols.length === 0) {
    return res.status(400).json({ error: 'symbols query param required' });
  }
  
  const cached = await getMultipleStocks(symbols);
  const cachedSymbols = Array.from(cached.keys());
  const missingSymbols = symbols.filter(s => !cachedSymbols.includes(s));
  
  if (missingSymbols.length > 0) {
    const fresh: Record<string, unknown> = {};
    for (const symbol of missingSymbols) {
      try {
        const quote = await YahooFinanceService.getQuote(symbol);
        if (quote) {
          fresh[symbol] = quote;
        }
      } catch (error) {
        logger.warn(`Failed to fetch ${symbol}: ${(error as Error).message}`);
      }
    }
    
    return res.json({
      source: 'mixed',
      cached: Object.fromEntries(cached),
      fresh,
      cachedCount: cachedSymbols.length,
      freshCount: Object.keys(fresh).length,
    });
  }
  
  return res.json({
    source: 'cache',
    data: Object.fromEntries(cached),
  });
});

router.get('/indices/:symbol', async (req: Request, res: Response) => {
  const { symbol } = req.params;
  
  const cached = await getIndexData(symbol);
  if (cached) {
    return res.json({ source: 'cache', data: cached });
  }
  
  try {
    const index = await YahooFinanceService.getIndex(symbol);
    if (!index) {
      return res.status(404).json({ error: 'Index not found' });
    }
    return res.json({ source: 'api', data: index });
  } catch (error) {
    logger.error(`Failed to fetch index ${symbol}: ${(error as Error).message}`);
    return res.status(500).json({ error: 'Failed to fetch index' });
  }
});

router.get('/scanner/:type', async (req: Request, res: Response) => {
  const { type } = req.params;
  const validTypes = ['movers', 'volume', 'breakout', 'falling'];
  
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid scanner type. Valid: ${validTypes.join(', ')}` });
  }
  
  const cached = await getScannerCache(type);
  if (cached) {
    return res.json({
      source: 'cache',
      data: cached.stocks,
      generatedAt: cached.generatedAt,
      expiresAt: cached.expiresAt,
    });
  }
  
  return res.status(404).json({ error: 'Scanner data not yet computed. Try again later.' });
});

export default router;
