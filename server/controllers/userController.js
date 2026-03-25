import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

export const getGlobalConnections = async (req, res) => {
  let query = '';
  let queryParams = [];
  try {
    const userId = (req.user && req.user.id) ? req.user.id : req.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    query = `
      SELECT
        COALESCE(
          MIN(c.id),
          CONCAT('workspace-', u.id)
        ) AS connection_id,
        u.id AS user_id,
        u.name,
        u.email,
        u.avatar_url,
        u.last_active,
        GROUP_CONCAT(
          DISTINCT participants.workspace_name
          ORDER BY participants.workspace_name
          SEPARATOR ', '
        ) AS shared_workspaces
      FROM (
        SELECT DISTINCT w.id, w.name
        FROM workspaces w
        LEFT JOIN workspace_members wm_me
          ON wm_me.workspace_id = w.id AND wm_me.user_id = ?
        WHERE w.owner_id = ? OR wm_me.user_id = ?
      ) my_workspaces
      JOIN (
        SELECT w.id AS workspace_id, w.name AS workspace_name, w.owner_id AS participant_user_id
        FROM workspaces w
        UNION ALL
        SELECT wm.workspace_id, w.name AS workspace_name, wm.user_id AS participant_user_id
        FROM workspace_members wm
        JOIN workspaces w ON w.id = wm.workspace_id
      ) participants ON participants.workspace_id = my_workspaces.id
      JOIN users u ON u.id = participants.participant_user_id
      LEFT JOIN connections c ON (
        (c.user_a_id = ? AND c.user_b_id = u.id)
        OR (c.user_b_id = ? AND c.user_a_id = u.id)
      )
      WHERE u.id <> ?
      GROUP BY u.id, u.name, u.email, u.avatar_url, u.last_active
      ORDER BY u.name ASC
    `;

    queryParams = [userId, userId, userId, userId, userId, userId];
    const [connections] = await pool.query(query, queryParams);

    const formattedConnections = connections.map(conn => ({
      connection_id: conn.connection_id,
      user_id: conn.user_id,
      name: conn.name,
      email: conn.email,
      avatar_url: conn.avatar_url || null,
      last_active: conn.last_active || null,
      shared_workspaces: conn.shared_workspaces || ''
    }));

    res.json(formattedConnections);
  } catch (error) {
    console.error('[GET /user/connections] Erro detalhado ao buscar conexões', {
      message: error?.message,
      sqlMessage: error?.sqlMessage,
      sqlCode: error?.code,
      query,
      queryParams,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
  }
};

export const breakConnection = async (req, res) => {
  let connection;
  try {
    const currentUserId = (req.user && req.user.id) ? req.user.id : req.user_id;
    const targetUserId = req.params.userId;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'ID do usuário alvo é obrigatório' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(`
      DELETE FROM connections 
      WHERE (user_a_id = ? AND user_b_id = ?) 
         OR (user_a_id = ? AND user_b_id = ?)
    `, [currentUserId, targetUserId, targetUserId, currentUserId]);

    await connection.query(`
      DELETE wm_target
      FROM workspace_members wm_target
      JOIN workspaces w ON w.id = wm_target.workspace_id
      LEFT JOIN workspace_members wm_current
        ON wm_current.workspace_id = w.id AND wm_current.user_id = ?
      WHERE wm_target.user_id = ?
        AND (w.owner_id = ? OR wm_current.user_id = ?)
    `, [currentUserId, targetUserId, currentUserId, currentUserId]);

    await connection.query(`
      DELETE wm_current
      FROM workspace_members wm_current
      JOIN workspaces w ON w.id = wm_current.workspace_id
      LEFT JOIN workspace_members wm_target
        ON wm_target.workspace_id = w.id AND wm_target.user_id = ?
      WHERE wm_current.user_id = ?
        AND (w.owner_id = ? OR wm_target.user_id = ?)
    `, [targetUserId, currentUserId, targetUserId, targetUserId]);

    await connection.commit();

    res.json({ success: true, message: 'Conexão quebrada com sucesso' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('[DELETE /user/connections/:userId] Erro detalhado ao quebrar conexão:', error);
    res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
  } finally {
    if (connection) {
      connection.release();
    }
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
