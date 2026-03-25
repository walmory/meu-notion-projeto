import express from 'express';
import { getPendingInvitations, respondToInvitation } from '../controllers/invitationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/pending', getPendingInvitations);
router.post('/:id/respond', respondToInvitation);

export default router;
