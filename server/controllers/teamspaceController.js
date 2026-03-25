import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

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

export const getTeamspaceMembers = async (req, res) => {
  const { id } = req.params;
  try {
    const [members] = await pool.query(
      `SELECT u.id as user_id, u.name, u.email, 'member' as role
       FROM users u
       JOIN workspace_members wm ON u.id = wm.user_id
       JOIN teamspaces t ON t.workspace_id = wm.workspace_id
       WHERE t.id = ?
       
       UNION
       
       SELECT u.id as user_id, u.name, u.email, 'owner' as role
       FROM users u
       JOIN teamspaces t ON t.created_by = u.id
       WHERE t.id = ?`,
      [id, id]
    );
    res.json(members);
  } catch (error) {
    console.error('Error fetching teamspace members:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
export const getTeamspaces = async (req, res) => {
  const workspaceId = req.workspace_id;

  if (!workspaceId) {
    return res.json([]);
  }

  try {
    await ensureTeamspaceTrashColumn();

    const [teamspaces] = await pool.query(
      `SELECT id, workspace_id, name, created_by, invite_code, description, icon, is_trash
       FROM teamspaces
       WHERE workspace_id = ? AND (is_trash = 0 OR is_trash IS NULL)`,
      [workspaceId]
    );

    return res.json(teamspaces);
  } catch (error) {
    console.error('Error fetching teamspaces:', error);
    return res.status(500).json({ error: 'Failed to fetch teamspaces', details: error.message });
  }
};

export const createTeamspace = async (req, res) => {
  const workspaceId = req.workspace_id;
  const { name } = req.body;
  
  if (!name || !workspaceId) {
    return res.status(400).json({ error: 'Name and workspace_id are required' });
  }

  try {
    await ensureTeamspaceTrashColumn();

    const id = uuidv4();
    await pool.query(
      'INSERT INTO teamspaces (id, name, workspace_id, created_by) VALUES (?, ?, ?, ?)',
      [id, name, workspaceId, req.user_id]
    );

    const [created] = await pool.query(
      'SELECT id, workspace_id, name, created_by, invite_code, description, icon, is_trash FROM teamspaces WHERE id = ? AND workspace_id = ?',
      [id, workspaceId]
    );

    return res.status(201).json(created[0]);
  } catch (error) {
    console.error('Error creating teamspace:', error);
    return res.status(500).json({ error: 'Failed to create teamspace', details: error.message });
  }
};

export const deleteTeamspace = async (req, res) => {
  const workspaceId = req.workspace_id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    await ensureTeamspaceTrashColumn();

    const [teamspaceRows] = await pool.query(
      `SELECT t.id
       FROM teamspaces t
       WHERE t.id = ? AND t.workspace_id = ?
       LIMIT 1`,
      [id, workspaceId]
    );

    if (teamspaceRows.length === 0) {
      return res.status(404).json({ error: 'Teamspace not found or unauthorized' });
    }

    await pool.query(
      'UPDATE teamspaces SET is_trash = 1 WHERE id = ? AND workspace_id = ?',
      [id, workspaceId]
    );

    await pool.query(
      'UPDATE documents SET is_trash = 1 WHERE teamspace_id = ? AND workspace_id = ?',
      [id, workspaceId]
    );

    return res.status(204).send();
  } catch (error) {
    console.error('Error moving teamspace to trash:', error);
    return res.status(500).json({ error: 'Failed to delete teamspace', details: error.message });
  }
};
