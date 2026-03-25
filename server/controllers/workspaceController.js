import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { emitToUserEmail } from '../socket.js';

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

const ensureWorkspaceMemberLastAccessColumn = async () => {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'workspace_members'
       AND COLUMN_NAME = 'last_accessed_at'
     LIMIT 1`
  );

  if (columns.length === 0) {
    await pool.query(
      'ALTER TABLE workspace_members ADD COLUMN last_accessed_at DATETIME NULL DEFAULT NULL'
    );
  }
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
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID missing' });
    }

    await ensureWorkspaceMembersTable();
    await ensureWorkspaceMemberLastAccessColumn();

    const [workspaces] = await pool.query(
      `SELECT w.*, 
        wm.last_accessed_at,
        CASE WHEN w.owner_id = ? THEN 'owner' ELSE wm.role END as user_role
       FROM workspaces w 
       LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
       WHERE (w.owner_id = ? OR wm.user_id = ?)
         AND (w.is_trash = 0 OR w.is_trash IS NULL)
       ORDER BY COALESCE(wm.last_accessed_at, w.created_at) DESC`,
      [userId, userId, userId, userId]
    );

    res.json(workspaces);
  } catch (error) {
    console.error('Failed to fetch workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
};

export const createWorkspace = async (req, res) => {
  const { name } = req.body;
  const userId = req.user_id;

  if (!name) {
    return res.status(400).json({ error: 'Workspace name is required' });
  }

  const connection = await pool.getConnection();

  try {
    await ensureWorkspaceMembersTable();
    await ensureWorkspaceMemberLastAccessColumn();
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
      'INSERT INTO workspace_members (workspace_id, user_id, last_accessed_at) VALUES (?, ?, NOW())',
      [workspaceId, userId]
    );

    await connection.commit();

    const newWorkspace = mapWorkspace({ id: workspaceId, name, owner_id: userId }, req.user_email);
    return res.status(201).json(newWorkspace);
  } catch (error) {
    await connection.rollback();
    console.error('Error creating workspace (Atomic):', error);
    return res.status(500).json({ error: 'Failed to create workspace', details: error.message });
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
    return res.status(500).json({ error: 'Failed to fetch members' });
  }
};

export const inviteMember = async (req, res) => {
  const workspaceId = req.workspace_id;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const [users] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
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

    return res.status(200).json({ message: 'Member successfully added' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to invite member' });
  }
};

export const removeMember = async (req, res) => {
  const workspaceId = req.workspace_id;
  const { email } = req.params;

  try {
    const [users] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = users[0].id;

    await pool.query(
      'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId]
    );

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to remove member' });
  }
};

export const inviteWorkspaceMember = async (req, res) => {
  const workspaceId = req.params.id;
  const invitedBy = req.user_id;
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
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
      return res.status(403).json({ error: 'No permission to invite to this workspace' });
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
      return res.status(409).json({ error: 'User is already a member of this workspace' });
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

    const inviteId = uuidv4();
    await pool.query(
      `INSERT INTO workspace_invitations (id, workspace_id, email, invited_by, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [inviteId, workspaceId, email, invitedBy]
    );

    const [workspaceInfo] = await pool.query('SELECT name FROM workspaces WHERE id = ? LIMIT 1', [workspaceId]);
    const [inviterInfo] = await pool.query('SELECT name FROM users WHERE id = ? LIMIT 1', [invitedBy]);

    if (workspaceInfo.length > 0 && inviterInfo.length > 0) {
      const workspaceName = workspaceInfo[0].name;
      const inviterName = inviterInfo[0].name || 'User';

      emitToUserEmail(email, 'workspace_invite', {
        id: inviteId,
        workspaceId,
        workspaceName,
        inviterName,
        email
      });
    }

    return res.status(201).json({ message: 'Invite Sent' });
  } catch (error) {
    console.error('Error inviting member via /workspaces/:id/invite:', error);
    return res.status(500).json({ error: 'Failed to send invite', details: error.message });
  }
};

export const getPendingInvitationsCount = async (req, res) => {
  const workspaceId = req.workspace_id;
  const email = String(req.user_email || '').trim().toLowerCase();

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  if (!email) {
    return res.status(400).json({ error: 'user email is required' });
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
    console.error('Error fetching pending invites count:', error);
    return res.status(500).json({ error: 'Failed to fetch pending invites', details: error.message });
  }
};

export const deleteWorkspace = async (req, res) => {
  const { id } = req.params;
  const userId = req.user_id;

  if (!id) {
    return res.status(400).json({ error: 'id is required' });
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
      return res.status(403).json({ error: 'Only the owner can delete this workspace' });
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
    return res.status(500).json({ error: 'Failed to delete workspace', details: error.message });
  } finally {
    connection.release();
  }
};

export const getMyInvites = async (req, res) => {
  const email = String(req.user_email || '').trim().toLowerCase();

  try {
    await ensureWorkspaceInvitationsTable();
    
    // JOIN com 'workspaces' para pegar o nome do workspace
    // JOIN com 'users' para pegar o nome de quem convidou (invited_by)
    const [invites] = await pool.query(
      `SELECT 
         wi.id, 
         wi.workspace_id, 
         w.name AS workspace_name, 
         u.name AS inviter_name
       FROM workspace_invitations wi
       JOIN workspaces w ON w.id = wi.workspace_id
       JOIN users u ON u.id = wi.invited_by
       WHERE LOWER(wi.email) = LOWER(?) 
         AND wi.status = 'pending'`,
      [email]
    );

    return res.json(invites);
  } catch (error) {
    // Log claro no backend com detalhes do SQL para debug
    console.error('[GET /workspaces/my-invites] Error fetching invites:', error);
    
    // Detailed return so frontend is not "in the dark"
    return res.status(500).json({ 
      error: 'Failed to fetch user invites.',
      details: error.message,
      sqlMessage: error.sqlMessage || 'No specific SQL error'
    });
  }
};

export const acceptInvite = async (req, res) => {
  const { inviteId } = req.params;
  const userId = req.user_id;
  const email = String(req.user_email || '').trim().toLowerCase();

  const connection = await pool.getConnection();
  try {
    await ensureWorkspaceMembersTable();
    await ensureWorkspaceMemberLastAccessColumn();
    await connection.beginTransaction();

    const [invites] = await connection.query(
      `SELECT * FROM workspace_invitations WHERE id = ? AND LOWER(email) = LOWER(?) AND status = 'pending' LIMIT 1`,
      [inviteId, email]
    );

    if (invites.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Invite not found or already processed' });
    }

    const invite = invites[0];

    const [existing] = await connection.query(
      'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [invite.workspace_id, userId]
    );

    if (existing.length === 0) {
      await connection.query(
        'INSERT INTO workspace_members (workspace_id, user_id, last_accessed_at) VALUES (?, ?, NOW())',
        [invite.workspace_id, userId]
      );
    }

    await connection.query('DELETE FROM workspace_invitations WHERE id = ?', [inviteId]);

    await connection.commit();
    return res.status(200).json({ message: 'Invite successfully accepted' });
  } catch (error) {
    await connection.rollback();
    console.error('Error accepting invite:', error);
    return res.status(500).json({ error: 'Failed to accept invite' });
  } finally {
    connection.release();
  }
};

export const setActiveWorkspace = async (req, res) => {
  const userId = req.user_id;
  const workspaceId = String(req.body?.workspace_id || '').trim();

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    await ensureWorkspaceMembersTable();
    await ensureWorkspaceMemberLastAccessColumn();
    await ensureWorkspaceTrashColumn();

    const [accessRows] = await pool.query(
      `SELECT w.id
       FROM workspaces w
       LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
       WHERE w.id = ?
         AND (w.owner_id = ? OR wm.user_id = ?)
         AND (w.is_trash = 0 OR w.is_trash IS NULL)
       LIMIT 1`,
      [userId, workspaceId, userId, userId]
    );

    if (!Array.isArray(accessRows) || accessRows.length === 0) {
      return res.status(403).json({ error: 'Workspace access denied' });
    }

    const [updated] = await pool.query(
      `UPDATE workspace_members
       SET last_accessed_at = NOW()
       WHERE workspace_id = ? AND user_id = ?`,
      [workspaceId, userId]
    );

    if (Number(updated?.affectedRows || 0) === 0) {
      await pool.query(
        `INSERT INTO workspace_members (workspace_id, user_id, last_accessed_at)
         VALUES (?, ?, NOW())`,
        [workspaceId, userId]
      );
    }

    return res.json({ workspace_id: workspaceId, updated: true });
  } catch (error) {
    console.error('Failed to set active workspace:', error);
    return res.status(500).json({ error: 'Failed to set active workspace', details: error.message });
  }
};

export const declineInvite = async (req, res) => {
  const { inviteId } = req.params;
  const email = String(req.user_email || '').trim().toLowerCase();

  try {
    const [result] = await pool.query(
      `DELETE FROM workspace_invitations WHERE id = ? AND LOWER(email) = LOWER(?) AND status = 'pending'`,
      [inviteId, email]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invite not found or already processed' });
    }

    return res.status(200).json({ message: 'Convite recusado' });
  } catch (error) {
    console.error('Error declining invite:', error);
    return res.status(500).json({ error: 'Failed to decline invite' });
  }
};

export const getWorkspacePendingInvites = async (req, res) => {
  const workspaceId = req.params.id;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    await ensureWorkspaceInvitationsTable();
    const [invites] = await pool.query(
      `SELECT id, email, status, created_at
       FROM workspace_invitations
       WHERE workspace_id = ? AND status = 'pending'`,
      [workspaceId]
    );

    return res.json(invites);
  } catch (error) {
    console.error('Error fetching pending invites for workspace:', error);
    return res.status(500).json({ error: 'Failed to fetch pending invites' });
  }
};

export const cancelWorkspaceInvite = async (req, res) => {
  const { id: workspaceId, inviteId } = req.params;

  try {
    const [result] = await pool.query(
      `DELETE FROM workspace_invitations WHERE id = ? AND workspace_id = ? AND status = 'pending'`,
      [inviteId, workspaceId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invite not found or already processed' });
    }

    return res.status(200).json({ message: 'Convite cancelado' });
  } catch (error) {
    console.error('Error cancelling invite:', error);
    return res.status(500).json({ error: 'Failed to cancel invite' });
  }
};
