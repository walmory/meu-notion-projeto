import express from 'express';
import { getProfile, updateProfile, updateEmail, updatePassword, getGlobalConnections, breakConnection } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

console.log("👉 User Route Successfully Loaded");

const router = express.Router();

router.get('/test', (_req, res) => {
  res.send('Rota User funcionando!');
});

// Teste de isolamento: Aceitar qualquer método (GET, POST, PUT)
router.all('/profile-test', (req, res) => {
  res.send('OK - Rota Profile Existe');
});

router.get('/connections', authMiddleware, getGlobalConnections);
router.delete('/connections/:userId', authMiddleware, breakConnection);

router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.put('/update-email', authMiddleware, updateEmail);
router.put('/update-password', authMiddleware, updatePassword);

export default router;
