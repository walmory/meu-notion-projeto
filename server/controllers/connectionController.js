import pool from '../config/db.js';

export const getConnections = async (req, res) => {
  try {
    const userId = req.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.name, u.email, u.avatar_url
       FROM users u
       JOIN workspace_members wm1 ON u.id = wm1.user_id
       JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
       WHERE wm2.user_id = ? AND u.id != ?`,
      [userId, userId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar conexões:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const breakConnection = async (req, res) => {
  try {
    const userId = req.user_id;
    const { targetUserId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId é obrigatório' });
    }

    // 1. Encontrar os workspaces onde userId é dono
    const [myWorkspaces] = await pool.query(
      'SELECT id FROM workspaces WHERE owner_id = ?',
      [userId]
    );
    const myWorkspaceIds = myWorkspaces.map(w => w.id);

    // 2. Encontrar os workspaces onde targetUserId é dono
    const [targetWorkspaces] = await pool.query(
      'SELECT id FROM workspaces WHERE owner_id = ?',
      [targetUserId]
    );
    const targetWorkspaceIds = targetWorkspaces.map(w => w.id);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Remover targetUser dos meus workspaces
      if (myWorkspaceIds.length > 0) {
        await connection.query(
          `DELETE FROM workspace_members WHERE workspace_id IN (?) AND user_id = ?`,
          [myWorkspaceIds, targetUserId]
        );
      }

      // Remover eu dos workspaces do targetUser
      if (targetWorkspaceIds.length > 0) {
        await connection.query(
          `DELETE FROM workspace_members WHERE workspace_id IN (?) AND user_id = ?`,
          [targetWorkspaceIds, userId]
        );
      }

      await connection.commit();
      res.json({ success: true, message: 'Conexão rompida com sucesso' });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao romper conexão:', error);
    res.status(500).json({ error: 'Erro interno no servidor ao romper conexão' });
  }
};
