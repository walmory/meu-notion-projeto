import express from 'express';
import { getProfile, updateProfile, updateEmail, updatePassword, getConnections, breakConnection, getInvitations, updateInvitation } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

console.log("👉 Rota de Usuário Carregada com Sucesso");

const router = express.Router();

router.get('/test', (_req, res) => {
  res.send('Rota User funcionando!');
});

// Teste de isolamento: Aceitar qualquer método (GET, POST, PUT)
router.all('/profile-test', (req, res) => {
  res.send('OK - Rota Profile Existe');
});

router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.put('/update-email', authMiddleware, updateEmail);
router.put('/update-password', authMiddleware, updatePassword);

// Members and Connections
router.get('/connections', authMiddleware, getConnections);
router.delete('/connections/:id', authMiddleware, breakConnection);
router.get('/invitations', authMiddleware, getInvitations);
router.patch('/invitations/:id', authMiddleware, updateInvitation);

export default router;
