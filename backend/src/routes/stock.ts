import { Router, Response } from 'express';
import { StockService } from '../services/stockService.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();

function setCacheHeaders(res: Response, maxAge = 60, swr = 300) {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`);
}

function setCache(res: any, maxAge = 60, swr = 300) {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`);
}

router.get('/:symbol/overview', asyncHandler(async (req, res) => {
  setCache(res, 60);
  const { symbol } = req.params;
  const data = await StockService.getOverview(symbol);
  if (!data) {
    return res.status(404).json({ success: false, error: 'Symbol not found' });
  }
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}));

router.get('/:symbol/chart', asyncHandler(async (req, res) => {
  setCache(res, 120);
  const { symbol } = req.params;
  const { period = '1mo' } = req.query;
  const data = await StockService.getChart(symbol, period as string);
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}));

router.get('/:symbol/fundamentals', asyncHandler(async (req, res) => {
  setCache(res, 3600, 86400);
  const { symbol } = req.params;
  const data = await StockService.getFundamentals(symbol);
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}));

router.get('/:symbol/news', asyncHandler(async (req, res) => {
  setCache(res, 300, 600);
  const { symbol } = req.params;
  const { limit = '20' } = req.query;
  const data = await StockService.getNews(symbol, parseInt(limit as string, 10));
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}));

router.get('/:symbol/insights', asyncHandler(async (req, res) => {
  setCache(res, 60);
  const { symbol } = req.params;
  const data = await StockService.getInsights(symbol);
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}));

export default router;
