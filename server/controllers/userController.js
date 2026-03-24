import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

export const getProfile = async (req, res) => {
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
};

export const updateProfile = async (req, res) => {
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
};

export const updateEmail = async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;
    const userId = (req.user && req.user.id) ? req.user.id : req.user_id;

    console.log('[Security Check - updateEmail] userId from token:', userId);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID missing from token' });
    }

    if (!newEmail || !currentPassword) {
      return res.status(400).json({ error: 'Novo e-mail e senha atual são obrigatórios' });
    }

    const [userRows] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      console.log('[Security Check - updateEmail] User not found in DB for ID:', userId);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userRows[0];
    
    console.log('--- DEBUG SENHA ---');
    console.log('Senha vinda do form:', req.body.currentPassword);
    console.log('Senha vinda do banco (hash/texto):', user.password);
    
    // Se a senha no banco for igual à digitada (texto puro), considere como sucesso
    // mas avise que precisamos atualizar para hash.
    const isPasswordValid = (req.body.currentPassword === user.password) || await bcrypt.compare(req.body.currentPassword, user.password);
    
    console.log('[Security Check - updateEmail] password match:', isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const [existingEmailRows] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail, userId]);
    if (existingEmailRows.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está em uso' });
    }

    await pool.query('UPDATE users SET email = ? WHERE id = ?', [newEmail, userId]);

    res.json({ success: true, message: 'E-mail atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar e-mail:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = (req.user && req.user.id) ? req.user.id : req.user_id;

    console.log('[Security Check - updatePassword] userId from token:', userId);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID missing from token' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    const [userRows] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      console.log('[Security Check - updatePassword] User not found in DB for ID:', userId);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userRows[0];
    
    console.log('--- DEBUG SENHA (PASSWORD) ---');
    console.log('Senha vinda do form:', req.body.currentPassword);
    console.log('Senha vinda do banco (hash/texto):', user.password);
    
    // Se a senha no banco for igual à digitada (texto puro), considere como sucesso
    // mas avise que precisamos atualizar para hash.
    const isPasswordValid = (req.body.currentPassword === user.password) || await bcrypt.compare(req.body.currentPassword, user.password);
    
    console.log('[Security Check - updatePassword] password match:', isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ success: true, message: 'Senha atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};
