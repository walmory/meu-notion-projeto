import express from 'express';
import pool from '../config/db.js';
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

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = (req.user && req.user.id) ? req.user.id : req.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [rows] = await pool.query(
      'SELECT name, email, bio, avatar_url FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, bio, avatar_url } = req.body;
    const userId = (req.user && req.user.id) ? req.user.id : req.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pool.query(
      `UPDATE users 
       SET 
         name = COALESCE(?, name), 
         bio = COALESCE(?, bio), 
         avatar_url = COALESCE(?, avatar_url) 
       WHERE id = ?`,
      [
        name !== undefined ? name : null,
        bio !== undefined ? bio : null,
        avatar_url !== undefined ? avatar_url : null,
        userId
      ]
    );

    res.json({ success: true, message: 'Perfil atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
