import express from 'express';
import pool from '../config/db.js';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { emitToWorkspace } from '../socket.js';

const router = express.Router();

router.use(authMiddleware);

export const updateTask = async (req, res) => {
  try {
    const taskId = req.params.taskId || req.params.id;
    const { title, status, assigned_to, due_date, position, priority, description } = req.body;
    
    const updateFields = [];
    const values = [];
    
    if (title !== undefined) { updateFields.push('title = ?'); values.push(title); }
    if (status !== undefined) { updateFields.push('status = ?'); values.push(status); }
    if (assigned_to !== undefined) { updateFields.push('assigned_to = ?'); values.push(assigned_to); }
    if (due_date !== undefined) { updateFields.push('due_date = ?'); values.push(due_date); }
    if (position !== undefined) { updateFields.push('position = ?'); values.push(position); }
    if (priority !== undefined) { updateFields.push('priority = ?'); values.push(priority); }
    if (description !== undefined) { updateFields.push('description = ?'); values.push(description); }
    
    if (updateFields.length > 0) {
      values.push(taskId);
      await pool.query(
        `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );
    }
    
    const [updatedTask] = await pool.query(`
      SELECT t.*, p.workspace_id 
      FROM tasks t 
      JOIN projects p ON t.project_id = p.id 
      WHERE t.id = ?
    `, [taskId]);

    if (updatedTask.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (updatedTask[0].workspace_id) {
      emitToWorkspace(updatedTask[0].workspace_id, 'task-updated', updatedTask[0]);
    }
    
    res.json(updatedTask[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating task' });
  }
};

// Get all projects for a user
router.get('/', async (req, res) => {
  try {
    const workspaceId = req.query.workspace_id || req.headers['x-workspace-id'];
    const teamspaceId = req.query.teamspace_id;
    let query = 'SELECT * FROM projects WHERE owner_id = ?';
    let params = [req.user.id];
    
    if (workspaceId) {
      query += ' AND workspace_id = ?';
      params.push(workspaceId);
    }

    if (teamspaceId) {
      query += ' AND teamspace_id = ?';
      params.push(teamspaceId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [projects] = await pool.query(query, params);
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching projects' });
  }
});

// Create a project
router.post('/', async (req, res) => {
  try {
    const { name, color, workspace_id, teamspace_id, id } = req.body;
    const projectId = id || crypto.randomUUID();
    
    await pool.query(
      'INSERT INTO projects (id, name, owner_id, workspace_id, teamspace_id, color) VALUES (?, ?, ?, ?, ?, ?)',
      [projectId, name, req.user.id, workspace_id || null, teamspace_id || null, color || 'blue']
    );
    
    const [newProject] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    res.status(201).json(newProject[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating project' });
  }
});

// Get tasks for a project
router.get('/:id/tasks', async (req, res) => {
  try {
    const [tasks] = await pool.query(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY position ASC, created_at ASC',
      [req.params.id]
    );
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching tasks' });
  }
});

// Create a task
router.post('/:id/tasks', async (req, res) => {
  try {
    const { title, status, assigned_to, due_date, priority, description, id } = req.body;
    const taskId = id || crypto.randomUUID();
    
    await pool.query(
      'INSERT INTO tasks (id, project_id, title, status, assigned_to, due_date, priority, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [taskId, req.params.id, title, status || 'To Do', assigned_to || null, due_date || null, priority || 'Normal', description || null]
    );
    
    const [newTask] = await pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.status(201).json(newTask[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating task' });
  }
});

router.patch('/tasks/:taskId', updateTask);

// Update a project
router.patch('/:id', async (req, res) => {
  try {
    const { name, color } = req.body;
    
    let updateFields = [];
    let values = [];
    
    if (name !== undefined) { updateFields.push('name = ?'); values.push(name); }
    if (color !== undefined) { updateFields.push('color = ?'); values.push(color); }
    
    if (updateFields.length > 0) {
      values.push(req.params.id);
      values.push(req.user.id);
      await pool.query(
        `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ? AND owner_id = ?`,
        values
      );
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating project' });
  }
});

// Delete a project
router.delete('/:id', async (req, res) => {
  try {
    // Delete project tasks first (in case ON DELETE CASCADE constraint is not set)
    await pool.query('DELETE FROM tasks WHERE project_id = ?', [req.params.id]);
    await pool.query('DELETE FROM projects WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting project' });
  }
});

// Delete a task
router.delete('/tasks/:taskId', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.taskId]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting task' });
  }
});

export default router;
