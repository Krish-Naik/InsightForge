import { Router } from 'express';
import { marketController } from '../controllers/marketController.js';

const router = Router();

router.get('/indices',                     marketController.getIndices);
router.get('/indices/list',                marketController.getIndicesList);
router.get('/catalog',                     marketController.getCatalog);
router.get('/primary-watchlist',            marketController.getPrimaryWatchlist);
router.get('/summary',                     marketController.getMarketSummary);
router.get('/today',                       marketController.getTodayDesk);
router.get('/sectors',                     marketController.getSectorPerformance);
router.get('/sectors/all',                 marketController.getAllSectorsData);
router.get('/sectors/:sector/stocks',      marketController.getStocksBySector);
router.get('/sectors/:sector/analytics',   marketController.getSectorAnalytics);
router.get('/movers',                      marketController.getMarketMovers);
router.get('/movers/by-cap',                 marketController.getMoversByCap);
router.get('/movers/enhanced',               marketController.getEnhancedMovers);
// ── Radar page endpoints (trading signals only) ─────────────────────────────
router.get('/radar/signals',               marketController.getRadarSnapshot);
router.get('/radar/sr/:symbol',            marketController.getSignalSupportResistance);
// ── Legacy radar (AI-based) ─────────────────────────────────────────────────
router.get('/radar',                       marketController.getOpportunityRadar);
// ── Screener endpoints ──────────────────────────────────────────────────────
router.get('/screener',                    marketController.getGuidedScreener);
router.post('/screener/run',               marketController.runScreenerFilters);
// ── Quotes, search, analytics ───────────────────────────────────────────────
router.get('/quotes',                      marketController.getQuotes);
router.get('/quote/:symbol',               marketController.getQuote);
router.get('/research/:symbol',            marketController.getStockResearch);
router.get('/story/:symbol',               marketController.getStockStory);
router.get('/search',                      marketController.searchStocks);
router.get('/analytics',                   marketController.getAnalytics);
router.get('/fundamentals',                marketController.getFundamentals);
router.get('/historical/:symbol',          marketController.getHistorical);
router.get('/nifty-stocks',               marketController.getNiftyStocks);
router.get('/sector-map',                  marketController.getSectorMap);
router.get('/news',                        marketController.getNews);

export default router;