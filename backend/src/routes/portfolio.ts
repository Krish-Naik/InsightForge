import { Router } from 'express';
import { portfolioController } from '../controllers/portfolioController.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.use(auth);

router.get('/', portfolioController.getAll);
router.post('/', portfolioController.create);
router.put('/:id', portfolioController.update);
router.delete('/:id', portfolioController.delete);
router.post('/:id/holdings', portfolioController.addHolding);
router.put('/:id/holdings/:holdingId', portfolioController.updateHolding);
router.delete('/:id/holdings/:holdingId', portfolioController.removeHolding);

export default router;