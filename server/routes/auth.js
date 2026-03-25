import express from 'express';
import { register, login, resetPassword, getCurrentInviteCode } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
// router.post('/forgot-password', forgotPassword); // Temporarily removed to unblock build
router.post('/reset-password', resetPassword);

// New Dynamic Invite System
router.get('/current-invite-code', authMiddleware, getCurrentInviteCode);

export default router;
