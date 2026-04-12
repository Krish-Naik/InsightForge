import { Router } from 'express';
import { watchlistController } from '../controllers/watchlistController.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.use(auth);

router.get('/', watchlistController.getAll);
router.post('/', watchlistController.create);
router.put('/:id', watchlistController.update);
router.delete('/:id', watchlistController.delete);
router.post('/:id/stocks', watchlistController.addStock);
router.delete('/:id/stocks/:symbol', watchlistController.removeStock);

export default router;