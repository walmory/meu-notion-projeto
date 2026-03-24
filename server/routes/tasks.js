import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { updateTask } from './projects.js';

const router = express.Router();

router.use(authMiddleware);
router.patch('/:id', updateTask);

export default router;
