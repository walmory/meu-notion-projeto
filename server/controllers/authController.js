import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

const signToken = (user) => {
  return jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const mapWorkspace = (workspace, ownerEmail, ownerName) => ({
  id: workspace.id,
  name: workspace.name.includes('João Victor') ? `Workspace do ${ownerName || 'User'}` : workspace.name,
  owner_id: workspace.owner_id,
  owner: ownerEmail
});

export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    
    // Testa explicitamente a conexão
    await connection.ping();
    
    await connection.beginTransaction();

    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }

    const userId = uuidv4();
    const workspaceId = uuidv4();

    await connection.query(
      'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
      [userId, name, email, password]
    );

    await connection.query(
      'INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)',
      [workspaceId, `Workspace do ${name}`, userId]
    );

    await connection.commit();

    const user = { id: userId, name, email };
    const workspace = { id: workspaceId, name: `Workspace do ${name}`, owner_id: userId, owner: email };

    return res.status(201).json({
      token: signToken(user),
      user,
      workspace
    });
  } catch (error) {
    console.error('ERRO NO REGISTER:', error);
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('ERRO NO ROLLBACK:', rollbackError);
      }
    }
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Serviço de banco de dados temporariamente indisponível' });
    }
    
    return res.status(500).json({ error: 'Falha ao registrar usuário', details: error.message });
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (e) {}
    }
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [users] = await pool.query(
      'SELECT id, name, email FROM users WHERE email = ? AND password = ? LIMIT 1',
      [email, password]
    );

    const user = users[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const [workspaces] = await pool.query(
      'SELECT id, name, owner_id FROM workspaces WHERE owner_id = ? LIMIT 1',
      [user.id]
    );

    const workspace = workspaces[0] ? mapWorkspace(workspaces[0], user.email, user.name) : null;

    return res.json({
      token: signToken(user),
      user,
      workspace
    });
  } catch (error) {
    console.error('ERRO NO LOGIN:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Serviço de banco de dados temporariamente indisponível' });
    }
    
    return res.status(500).json({ error: 'Falha ao autenticar usuário', details: error.message });
  }
};
