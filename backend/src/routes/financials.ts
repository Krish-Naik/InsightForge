import { Router } from 'express';
import { financialController } from '../controllers/financialController.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = Router();
router.use(apiLimiter);

router.get('/summary', financialController.getSummary);
router.get('/search', financialController.searchByMetrics);
router.get('/screener', financialController.getScreenerData);
router.get('/import', financialController.importFinancials);

router.get('/metrics/:symbol', financialController.getMetrics);
router.get('/metrics/:symbol/:year/:quarter', financialController.getQuarterlyMetrics);

router.get('/:symbol', financialController.getFinancials);
router.get('/:symbol/latest', financialController.getLatestFinancials);

export default router;