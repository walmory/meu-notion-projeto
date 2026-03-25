import express from 'express';
import { register, login, resetPassword } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
// router.post('/forgot-password', forgotPassword); // Temporarily removed to unblock build
router.post('/reset-password', resetPassword);

export default router;
