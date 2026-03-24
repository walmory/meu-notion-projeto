import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export const workspaceMiddleware = async (req, res, next) => {
  try {
    const providedWorkspaceId =
      req.query.workspace_id ||
      req.headers['x-workspace-id'] ||
      req.body?.workspace_id ||
      req.params.workspace_id;

    const userId = req.user_id;
    let workspaceId = providedWorkspaceId;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace_id, user_id)
      )
    `);

    const [trashColumn] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'workspaces'
         AND COLUMN_NAME = 'is_trash'
       LIMIT 1`
    );

    if (trashColumn.length === 0) {
      await pool.query(
        'ALTER TABLE workspaces ADD COLUMN is_trash TINYINT(1) NOT NULL DEFAULT 0'
      );
    }

    if (!workspaceId || workspaceId === 'null' || workspaceId === 'undefined') {
      const [firstWorkspaceRows] = await pool.query(
        `SELECT w.id
         FROM workspaces w
         LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
         WHERE (w.owner_id = ? OR wm.user_id = ?)
           AND (w.is_trash = 0 OR w.is_trash IS NULL)
         ORDER BY w.created_at ASC
         LIMIT 1`,
        [userId, userId, userId]
      );

      if (Array.isArray(firstWorkspaceRows) && firstWorkspaceRows.length > 0) {
        workspaceId = firstWorkspaceRows[0].id;
      } else {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          workspaceId = uuidv4();
          await connection.query(
            'INSERT INTO workspaces (id, name, owner_id, is_trash) VALUES (?, ?, ?, 0)',
            [workspaceId, 'Meu Workspace', userId]
          );
          await connection.query(
            'INSERT INTO workspace_members (workspace_id, user_id) VALUES (?, ?)',
            [workspaceId, userId]
          );
          await connection.commit();
        } catch (createError) {
          await connection.rollback();
          throw createError;
        } finally {
          connection.release();
        }
      }
    }

    const [rows] = await pool.query(
      `SELECT 1 FROM workspaces w 
       LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
       WHERE w.id = ?
         AND (w.owner_id = ? OR wm.user_id = ?)
         AND (w.is_trash = 0 OR w.is_trash IS NULL)
       LIMIT 1`,
      [userId, workspaceId, userId, userId]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Proibido. Você não tem acesso a este workspace.' });
    }

    req.workspace_id = workspaceId;
    next();
  } catch (error) {
    console.error('Erro no workspaceMiddleware:', error);
    return res.status(500).json({ error: 'Erro interno ao validar workspace' });
  }
};
