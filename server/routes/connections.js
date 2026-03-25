import express from 'express';
import { getConnections, breakConnection } from '../controllers/connectionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getConnections);
router.delete('/:targetUserId', breakConnection);

export default router;
