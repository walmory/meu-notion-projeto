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

// --- Members and Connections ---

export const getConnections = async (req, res) => {
  const userId = (req.user && req.user.id) ? req.user.id : req.user_id;
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.name, u.email, u.avatar_url
       FROM users u
       JOIN workspace_members wm ON u.id = wm.user_id
       WHERE wm.workspace_id IN (
         SELECT workspace_id FROM workspace_members WHERE user_id = ?
         UNION
         SELECT id FROM workspaces WHERE owner_id = ?
       )
       AND u.id != ?`,
      [userId, userId, userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar conexões:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const breakConnection = async (req, res) => {
  const currentUserId = (req.user && req.user.id) ? req.user.id : req.user_id;
  const targetUserId = req.params.id;

  try {
    // Remove target user from all workspaces owned by current user
    await pool.query(
      `DELETE FROM workspace_members 
       WHERE user_id = ? 
         AND workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)`,
      [targetUserId, currentUserId]
    );

    // Remove current user from all workspaces owned by target user
    await pool.query(
      `DELETE FROM workspace_members 
       WHERE user_id = ? 
         AND workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)`,
      [currentUserId, targetUserId]
    );

    // Optionally delete any pending invitations between them
    const [targetUsers] = await pool.query('SELECT email FROM users WHERE id = ? LIMIT 1', [targetUserId]);
    const [currentUsers] = await pool.query('SELECT email FROM users WHERE id = ? LIMIT 1', [currentUserId]);
    
    if (targetUsers.length > 0 && currentUsers.length > 0) {
      await pool.query(
        `DELETE FROM workspace_invitations 
         WHERE (invited_by = ? AND email = ?)
            OR (invited_by = ? AND email = ?)`,
        [currentUserId, targetUsers[0].email, targetUserId, currentUsers[0].email]
      );
    }

    res.status(204).send();
  } catch (error) {
    console.error('Erro ao romper conexão:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const getInvitations = async (req, res) => {
  const email = String(req.user_email || '').trim().toLowerCase();

  try {
    const [rows] = await pool.query(
      `SELECT wi.id, wi.workspace_id, w.name as workspace_name, wi.status, u.name as inviter_name, u.avatar_url as inviter_avatar
       FROM workspace_invitations wi
       JOIN workspaces w ON wi.workspace_id = w.id
       JOIN users u ON wi.invited_by = u.id
       WHERE LOWER(wi.email) = ? AND wi.status IN ('pending', 'dismissed')`,
      [email]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar convites:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const updateInvitation = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'accepted', 'declined', 'dismissed'
  const userId = (req.user && req.user.id) ? req.user.id : req.user_id;

  try {
    const [invites] = await pool.query('SELECT * FROM workspace_invitations WHERE id = ?', [id]);
    if (invites.length === 0) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }
    const invite = invites[0];

    if (status === 'accepted') {
      // Add to workspace_members
      const [existing] = await pool.query(
        'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
        [invite.workspace_id, userId]
      );
      if (existing.length === 0) {
        await pool.query(
          'INSERT INTO workspace_members (workspace_id, user_id) VALUES (?, ?)',
          [invite.workspace_id, userId]
        );
      }
      await pool.query('DELETE FROM workspace_invitations WHERE id = ?', [id]);
    } else if (status === 'declined') {
      await pool.query('DELETE FROM workspace_invitations WHERE id = ?', [id]);
    } else if (status === 'dismissed') {
      await pool.query('UPDATE workspace_invitations SET status = ? WHERE id = ?', [status, id]);
    }

    res.json({ success: true, message: 'Convite atualizado' });
  } catch (error) {
    console.error('Erro ao atualizar convite:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};
