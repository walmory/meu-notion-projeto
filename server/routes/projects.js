import express from 'express';
import pool from '../config/db.js';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { workspaceMiddleware } from '../middleware/workspaceMiddleware.js';
import { emitToWorkspace } from '../socket.js';

const router = express.Router();

router.use(authMiddleware);

// Get all projects for a user
router.get('/', async (req, res) => {
  try {
    const [projects] = await pool.query(
      'SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar projetos' });
  }
});

// Create a project
router.post('/', async (req, res) => {
  try {
    const { name, color, workspace_id, id } = req.body;
    const projectId = id || crypto.randomUUID();
    
    await pool.query(
      'INSERT INTO projects (id, name, owner_id, workspace_id, color) VALUES (?, ?, ?, ?, ?)',
      [projectId, name, req.user.id, workspace_id || null, color || 'blue']
    );
    
    const [newProject] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
    res.status(201).json(newProject[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar projeto' });
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
    res.status(500).json({ error: 'Erro ao buscar tasks' });
  }
});

// Create a task
router.post('/:id/tasks', async (req, res) => {
  try {
    const { title, status, assigned_to, due_date, id } = req.body;
    const taskId = id || crypto.randomUUID();
    
    await pool.query(
      'INSERT INTO tasks (id, project_id, title, status, assigned_to, due_date) VALUES (?, ?, ?, ?, ?, ?)',
      [taskId, req.params.id, title, status || 'To Do', assigned_to || null, due_date || null]
    );
    
    const [newTask] = await pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.status(201).json(newTask[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar task' });
  }
});

// Update a task (e.g. status)
router.patch('/tasks/:taskId', async (req, res) => {
  try {
    const { title, status, assigned_to, due_date, position } = req.body;
    
    let updateFields = [];
    let values = [];
    
    if (title !== undefined) { updateFields.push('title = ?'); values.push(title); }
    if (status !== undefined) { updateFields.push('status = ?'); values.push(status); }
    if (assigned_to !== undefined) { updateFields.push('assigned_to = ?'); values.push(assigned_to); }
    if (due_date !== undefined) { updateFields.push('due_date = ?'); values.push(due_date); }
    if (position !== undefined) { updateFields.push('position = ?'); values.push(position); }
    
    if (updateFields.length > 0) {
      values.push(req.params.taskId);
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
    `, [req.params.taskId]);
    
    if (updatedTask.length > 0 && updatedTask[0].workspace_id) {
      emitToWorkspace(updatedTask[0].workspace_id, 'task-updated', updatedTask[0]);
    }
    
    res.json(updatedTask[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar task' });
  }
});

// Delete a project
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir projeto' });
  }
});

// Delete a task
router.delete('/tasks/:taskId', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.taskId]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir task' });
  }
});

export default router;