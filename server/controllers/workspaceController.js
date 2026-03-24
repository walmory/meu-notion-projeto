import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const ensureWorkspaceMembersTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (workspace_id, user_id)
    )
  `);
};

const ensureWorkspaceInvitationsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_invitations (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      workspace_id VARCHAR(36) NOT NULL,
      email VARCHAR(255) NOT NULL,
      invited_by VARCHAR(36) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const ensureWorkspaceTrashColumn = async () => {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'workspaces'
       AND COLUMN_NAME = 'is_trash'
     LIMIT 1`
  );

  if (columns.length === 0) {
    await pool.query(
      'ALTER TABLE workspaces ADD COLUMN is_trash TINYINT(1) NOT NULL DEFAULT 0'
    );
  }
};

const ensureTeamspaceTrashColumn = async () => {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'teamspaces'
       AND COLUMN_NAME = 'is_trash'
     LIMIT 1`
  );

  if (columns.length === 0) {
    await pool.query(
      'ALTER TABLE teamspaces ADD COLUMN is_trash TINYINT(1) NOT NULL DEFAULT 0'
    );
  }
};

const mapWorkspace = (workspace, ownerEmail, ownerName) => ({
  id: workspace.id,
  name: workspace.name,
  owner_id: workspace.owner_id,
  owner: ownerEmail
});

export const getWorkspaces = async (req, res) => {
  try {
    await ensureWorkspaceMembersTable();
    await ensureWorkspaceTrashColumn();
    const [workspaces] = await pool.query(
      `SELECT w.id, w.name, w.owner_id 
       FROM workspaces w
       LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
       WHERE (w.owner_id = ? OR wm.user_id = ?)
         AND (w.is_trash = 0 OR w.is_trash IS NULL)`,
      [req.user_id, req.user_id, req.user_id]
    );

    const result = workspaces.map((workspace) => mapWorkspace(workspace, req.user_email, req.user_name));
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Falha ao buscar workspaces' });
  }
};

export const createWorkspace = async (req, res) => {
  const { name } = req.body;
  const userId = req.user_id;

  if (!name) {
    return res.status(400).json({ error: 'O nome do workspace é obrigatório' });
  }

  const connection = await pool.getConnection();

  try {
    await ensureWorkspaceMembersTable();
    await ensureWorkspaceTrashColumn();
    await connection.beginTransaction();

    const workspaceId = uuidv4();

    // Ação 1: Insere o workspace
    await connection.query(
      'INSERT INTO workspaces (id, name, owner_id, is_trash) VALUES (?, ?, ?, 0)',
      [workspaceId, name, userId]
    );

    // Ação 2: Insere o dono na tabela de membros (IMEDIATAMENTE)
    await connection.query(
      'INSERT INTO workspace_members (workspace_id, user_id) VALUES (?, ?)',
      [workspaceId, userId]
    );

    await connection.commit();

    const newWorkspace = mapWorkspace({ id: workspaceId, name, owner_id: userId }, req.user_email);
    return res.status(201).json(newWorkspace);
  } catch (error) {
    await connection.rollback();
    console.error('Erro ao criar workspace (Atomic):', error);
    return res.status(500).json({ error: 'Falha ao criar workspace', details: error.message });
  } finally {
    connection.release();
  }
};

export const getWorkspaceMembers = async (req, res) => {
  const workspaceId = req.workspace_id;
  try {
    await ensureWorkspaceMembersTable();
    const [members] = await pool.query(
      `SELECT w.id as workspace_id, owner_user.email as user_email, owner_user.name as user_name, owner_user.id as user_id, 'owner' as role
       FROM workspaces w
       JOIN users owner_user ON owner_user.id = w.owner_id
       WHERE w.id = ?
       UNION
       SELECT wm.workspace_id, u.email as user_email, u.name as user_name, u.id as user_id, 'member' as role
       FROM workspace_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = ?
         AND wm.user_id <> (SELECT owner_id FROM workspaces WHERE id = ? LIMIT 1)`,
      [workspaceId, workspaceId, workspaceId]
    );
    return res.json(Array.isArray(members) ? members : []);
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao buscar membros' });
  }
};

export const inviteMember = async (req, res) => {
  const workspaceId = req.workspace_id;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório' });
  }

  try {
    const [users] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userId = users[0].id;

    const [existing] = await pool.query(
      'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId]
    );

    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO workspace_members (workspace_id, user_id) VALUES (?, ?)',
        [workspaceId, userId]
      );
    }

    return res.status(200).json({ message: 'Membro adicionado com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao convidar membro' });
  }
};

export const removeMember = async (req, res) => {
  const workspaceId = req.workspace_id;
  const { email } = req.params;

  try {
    const [users] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userId = users[0].id;

    await pool.query(
      'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId]
    );

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao remover membro' });
  }
};

export const inviteWorkspaceMember = async (req, res) => {
  const workspaceId = req.params.id;
  const invitedBy = req.user_id;
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id é obrigatório' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório' });
  }

  try {
    await ensureWorkspaceMembersTable();
    await ensureWorkspaceInvitationsTable();
    await ensureWorkspaceTrashColumn();

    const [accessRows] = await pool.query(
      `SELECT w.id
       FROM workspaces w
       LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
       WHERE w.id = ?
         AND (w.owner_id = ? OR wm.user_id = ?)
         AND (w.is_trash = 0 OR w.is_trash IS NULL)
       LIMIT 1`,
      [invitedBy, workspaceId, invitedBy, invitedBy]
    );

    if (!Array.isArray(accessRows) || accessRows.length === 0) {
      return res.status(403).json({ error: 'Sem permissão para convidar neste workspace' });
    }

    const [members] = await pool.query(
      `SELECT wm.workspace_id
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ? AND LOWER(u.email) = LOWER(?)
       LIMIT 1`,
      [workspaceId, email]
    );

    if (Array.isArray(members) && members.length > 0) {
      return res.status(409).json({ error: 'Usuário já é membro deste workspace' });
    }

    const [pendingInvites] = await pool.query(
      `SELECT id
       FROM workspace_invitations
       WHERE workspace_id = ?
         AND LOWER(email) = LOWER(?)
         AND status = 'pending'
       LIMIT 1`,
      [workspaceId, email]
    );

    if (Array.isArray(pendingInvites) && pendingInvites.length > 0) {
      return res.status(200).json({ message: 'Convite já pendente para este email' });
    }

    await pool.query(
      `INSERT INTO workspace_invitations (id, workspace_id, email, invited_by, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [uuidv4(), workspaceId, email, invitedBy]
    );

    return res.status(201).json({ message: 'Invite Sent' });
  } catch (error) {
    console.error('Erro ao convidar membro via /workspaces/:id/invite:', error);
    return res.status(500).json({ error: 'Falha ao enviar convite', details: error.message });
  }
};

export const getPendingInvitationsCount = async (req, res) => {
  const workspaceId = req.workspace_id;
  const email = String(req.user_email || '').trim().toLowerCase();

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id é obrigatório' });
  }

  if (!email) {
    return res.status(400).json({ error: 'email do usuário é obrigatório' });
  }

  try {
    await ensureWorkspaceInvitationsTable();
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS pending_count
       FROM workspace_invitations
       WHERE workspace_id = ?
         AND LOWER(email) = LOWER(?)
         AND status = 'pending'`,
      [workspaceId, email]
    );
    const count = Number(rows?.[0]?.pending_count || 0);
    return res.json({ count });
  } catch (error) {
    console.error('Erro ao buscar contagem de convites pendentes:', error);
    return res.status(500).json({ error: 'Falha ao buscar convites pendentes', details: error.message });
  }
};

export const deleteWorkspace = async (req, res) => {
  const { id } = req.params;
  const userId = req.user_id;

  if (!id) {
    return res.status(400).json({ error: 'id é obrigatório' });
  }

  const connection = await pool.getConnection();

  try {
    await ensureWorkspaceMembersTable();
    await ensureWorkspaceTrashColumn();
    await ensureTeamspaceTrashColumn();
    await connection.beginTransaction();

    const [ownerRows] = await connection.query(
      `SELECT w.id
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id = w.id
       WHERE w.id = ?
         AND wm.user_id = ?
         AND w.owner_id = ?
         AND (w.is_trash = 0 OR w.is_trash IS NULL)
       LIMIT 1`,
      [id, userId, userId]
    );

    if (ownerRows.length === 0) {
      await connection.rollback();
      return res.status(403).json({ error: 'Apenas o dono pode excluir este workspace' });
    }

    await connection.query(
      'UPDATE workspaces SET is_trash = 1 WHERE id = ?',
      [id]
    );

    await connection.query(
      'UPDATE teamspaces SET is_trash = 1 WHERE workspace_id = ?',
      [id]
    );

    await connection.query(
      'UPDATE documents SET is_trash = 1 WHERE workspace_id = ?',
      [id]
    );

    await connection.commit();
    return res.status(204).send();
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ error: 'Falha ao excluir workspace', details: error.message });
  } finally {
    connection.release();
  }
};
