import express from 'express';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, bio, avatar_url } = req.body;
    const userId = req.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pool.query(
      'UPDATE users SET name = ?, bio = ?, avatar_url = ? WHERE id = ?',
      [name || null, bio || null, avatar_url || null, userId]
    );

    res.json({ success: true, message: 'Perfil atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;