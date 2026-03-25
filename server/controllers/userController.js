import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

export const getGlobalConnections = async (req, res) => {
  try {
    const userId = (req.user && req.user.id) ? req.user.id : req.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Busca na tabela 'connections' onde o usuário logado seja user_a_id ou user_b_id.
    // Faz um JOIN com 'users' para pegar os dados do membro conectado.
    const query = `
      SELECT 
        c.id as connection_id,
        u.id as user_id,
        u.name,
        u.email,
        u.avatar_url,
        u.created_at as joined_at,
        u.last_active
      FROM connections c
      JOIN users u ON (u.id = c.user_a_id OR u.id = c.user_b_id) AND u.id != ?
      WHERE c.user_a_id = ? OR c.user_b_id = ?
    `;

    const [connections] = await pool.query(query, [userId, userId, userId]);

    // Retorna o array limpo, garantindo que campos novos não quebrem se nulos
    const formattedConnections = connections.map(conn => ({
      connection_id: conn.connection_id,
      user_id: conn.user_id,
      name: conn.name,
      email: conn.email,
      avatar_url: conn.avatar_url || null,
      joined_at: conn.joined_at,
      last_active: conn.last_active || null
    }));

    res.json(formattedConnections);
  } catch (error) {
    console.error('[GET /user/connections] Erro detalhado ao buscar conexões:', error);
    res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
  }
};

export const breakConnection = async (req, res) => {
  try {
    const currentUserId = (req.user && req.user.id) ? req.user.id : req.user_id;
    const targetUserId = req.params.userId;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'ID do usuário alvo é obrigatório' });
    }

    // 1. Deletar o registro na tabela connections
    await pool.query(`
      DELETE FROM connections 
      WHERE (user_a_id = ? AND user_b_id = ?) 
         OR (user_a_id = ? AND user_b_id = ?)
    `, [currentUserId, targetUserId, targetUserId, currentUserId]);

    // 2. Remover de todos os workspace_members onde eles cruzam
    await pool.query(`
      DELETE wm FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE w.owner_id = ? AND wm.user_id = ?
    `, [currentUserId, targetUserId]);

    await pool.query(`
      DELETE wm FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE w.owner_id = ? AND wm.user_id = ?
    `, [targetUserId, currentUserId]);

    res.json({ success: true, message: 'Conexão quebrada com sucesso' });
  } catch (error) {
    console.error('[DELETE /user/connections/:userId] Erro detalhado ao quebrar conexão:', error);
    res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
  }
};

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
