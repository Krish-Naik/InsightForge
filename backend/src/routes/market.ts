import { Router } from 'express';
import { marketController } from '../controllers/marketController.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = Router();
router.use(apiLimiter);

router.get('/indices', marketController.getIndices);
router.get('/indices/list', marketController.getIndicesList);
router.get('/catalog', marketController.getCatalog);
router.get('/summary', marketController.getMarketSummary);
router.get('/today', marketController.getTodayDesk);
router.get('/sectors', marketController.getSectorPerformance);
router.get('/sectors/all', marketController.getAllSectorsData);
router.get('/sectors/:sector/stocks', marketController.getStocksBySector);
router.get('/sectors/:sector/analytics', marketController.getSectorAnalytics);
router.get('/movers', marketController.getMarketMovers);
router.get('/radar', marketController.getOpportunityRadar);
router.get('/screener', marketController.getGuidedScreener);
router.post('/screener/run', marketController.runScreenerFilters);
router.get('/quotes', marketController.getQuotes);
router.get('/quote/:symbol', marketController.getQuote);
router.get('/research/:symbol', marketController.getStockResearch);
router.get('/story/:symbol', marketController.getStockStory);
router.get('/search', marketController.searchStocks);
router.get('/analytics', marketController.getAnalytics);
router.get('/fundamentals', marketController.getFundamentals);
router.get('/historical/:symbol', marketController.getHistorical);
router.get('/nifty-stocks', marketController.getNiftyStocks);
router.get('/sector-map', marketController.getSectorMap);
router.get('/news', marketController.getNews);

export default router;