import express from 'express';
import bcrypt from 'bcrypt';
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

router.put('/update-email', authMiddleware, async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;
    const userId = (req.user && req.user.id) ? req.user.id : req.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!newEmail || !currentPassword) {
      return res.status(400).json({ error: 'Novo e-mail e senha atual são obrigatórios' });
    }

    // Buscar usuário atual para validar a senha
    const [userRows] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userRows[0];
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    // Validar se o novo email já existe
    const [existingEmailRows] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail, userId]);
    if (existingEmailRows.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está em uso' });
    }

    // Atualizar e-mail
    await pool.query('UPDATE users SET email = ? WHERE id = ?', [newEmail, userId]);

    res.json({ success: true, message: 'E-mail atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar e-mail:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

router.put('/update-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req.user && req.user.id) ? req.user.id : req.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    // Buscar usuário atual para validar a senha
    const [userRows] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userRows[0];
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    // Hashear e atualizar a nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ success: true, message: 'Senha atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

export default router;
