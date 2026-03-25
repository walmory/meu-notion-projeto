import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';

export const register = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    // Explicitly test connection
    await connection.ping();

    // Check if user exists
    const [existingUsers] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    await connection.beginTransaction();

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const workspaceId = uuidv4();

    // Insert user
    await connection.query(
      'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
      [userId, name, email, hashedPassword]
    );

    // Create default workspace
    await connection.query(
      'INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)',
      [workspaceId, `${name}'s Workspace`, userId]
    );

    // Add user as member to workspace
    await connection.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [workspaceId, userId, 'owner']
    );

    await connection.commit();

    const token = jwt.sign({ id: userId, email, name }, process.env.JWT_SECRET || 'change-this-secret', { expiresIn: '7d' });
    const workspace = { id: workspaceId, name: `${name}'s Workspace`, owner_id: userId, owner: email };

    res.status(201).json({ token, user: { id: userId, name, email }, workspace });
  } catch (error) {
    console.error('REGISTER ERROR:', error);
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('ROLLBACK ERROR:', rollbackError);
      }
    }
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Database service temporarily unavailable' });
    }
    return res.status(500).json({ error: 'Failed to register user', details: error.message });
  } finally {
    if (connection) connection.release();
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, process.env.JWT_SECRET || 'change-this-secret', { expiresIn: '7d' });

    // Fetch active workspace
    const [workspaces] = await pool.query(
      `SELECT w.* FROM workspaces w 
       LEFT JOIN workspace_members wm ON w.id = wm.workspace_id 
       WHERE w.owner_id = ? OR wm.user_id = ? LIMIT 1`,
      [user.id, user.id]
    );

    const workspace = workspaces.length > 0 ? workspaces[0] : null;

    res.json({ token, user: { id: user.id, name: user.name, email: user.email }, workspace });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Database service temporarily unavailable' });
    }
    return res.status(500).json({ error: 'Failed to authenticate user', details: error.message });
  }
};
