import pool from '../config/db.js';

export const workspaceMiddleware = async (req, res, next) => {
  try {
    // Busca o workspace_id da URL (query ou params) ou Header ou Body
    const workspaceId =
      req.query.workspace_id ||
      req.headers['x-workspace-id'] ||
      req.body?.workspace_id ||
      req.params.workspace_id;

    if (!workspaceId || workspaceId === 'null' || workspaceId === 'undefined') {
      return res.status(400).json({ error: 'workspace_id é obrigatório para acessar este recurso.' });
    }

    const userId = req.user_id;

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

    // Verifica se o usuário é dono do workspace OU se está na tabela workspace_members
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

    // Injeta o workspace_id validado no request para uso nos controllers
    req.workspace_id = workspaceId;
    next();
  } catch (error) {
    console.error('Erro no workspaceMiddleware:', error);
    return res.status(500).json({ error: 'Erro interno ao validar workspace' });
  }
};
