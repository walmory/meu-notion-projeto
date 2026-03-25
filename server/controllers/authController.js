import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';

let dynamicInvitesTableReady = false;

const ensureDynamicInvitesTable = async () => {
  if (dynamicInvitesTableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dynamic_invites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(6) NOT NULL,
        created_by VARCHAR(36) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    dynamicInvitesTableReady = true;
  } catch (err) {
    console.error('Failed to ensure dynamic_invites table:', err);
  }
};

export const register = async (req, res) => {
  await ensureDynamicInvitesTable();
  const connection = await pool.getConnection();
  try {
    const { name, email, password, inviteCode } = req.body;
    
    if (!name || !email || !password || !inviteCode) {
      return res.status(400).json({ error: 'Name, email, password and invite code are required' });
    }

    // Explicitly test connection
    await connection.ping();

    // Check invite code
    const [validCode] = await connection.query(
      'SELECT id FROM dynamic_invites WHERE code = ? AND expires_at > NOW()',
      [inviteCode]
    );

    if (validCode.length === 0) {
      return res.status(400).json({ error: 'Código de convite inválido ou expirado. Peça um novo código a um membro ativo.' });
    }

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

    const token = jwt.sign(
      { id: userId, email, name },
      process.env.JWT_SECRET || 'change-this-secret',
      { expiresIn: '7d' }
    );
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

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET || 'change-this-secret',
      { expiresIn: '7d' }
    );

    // Fetch active workspace
    const [workspaces] = await pool.query(
      `SELECT w.* FROM workspaces w 
       LEFT JOIN workspace_members wm ON w.id = wm.workspace_id 
       WHERE w.owner_id = ? OR wm.user_id = ? LIMIT 1`,
      [user.id, user.id]
    );

    const workspace = workspaces.length > 0 ? workspaces[0] : null;

    if (!workspace) {
      // Se não houver workspace, cria um imediatamente antes de retornar
      const newWorkspaceId = uuidv4();
      await pool.query(
        'INSERT INTO workspaces (id, name, owner_id, is_trash) VALUES (?, ?, ?, 0)',
        [newWorkspaceId, `${user.name}'s Workspace`, user.id]
      );
      await pool.query(
        'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
        [newWorkspaceId, user.id, 'owner']
      );
      
      return res.json({ 
        token, 
        user: { id: user.id, name: user.name, email: user.email }, 
        workspace: { id: newWorkspaceId, name: `${user.name}'s Workspace`, owner_id: user.id, owner: user.email }
      });
    }

    res.json({ token, user: { id: user.id, name: user.name, email: user.email }, workspace });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Database service temporarily unavailable' });
    }
    return res.status(500).json({ error: 'Failed to authenticate user', details: error.message });
  }
};

/* Temporarily commented out to unblock build
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [users] = await pool.query('SELECT id, name FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      // Do not reveal that the user does not exist for security reasons
      return res.json({ success: true, message: 'If the email exists, a reset link will be sent.' });
    }

    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    await pool.query(
      'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)',
      [email, resetToken, expiresAt]
    );

    // In a real application, you would send an email here using nodemailer, sendgrid, resend, etc.
    // Since this is a demo/portfolio, we'll just log the token and pretend it was sent.
    // The user will need to get the token from the server console or database to test locally.
    console.log(`\n======================================================`);
    console.log(`🔑 PASSWORD RESET LINK REQUESTED FOR: ${email}`);
    console.log(`🔗 Link: http://localhost:3000/reset-password?token=${resetToken}`);
    console.log(`======================================================\n`);

    res.json({ success: true, message: 'If the email exists, a reset link will be sent.' });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};
*/

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Check if token exists and is valid
    const [resetRequests] = await pool.query(
      'SELECT email FROM password_resets WHERE token = ? AND expires_at > NOW()',
      [token]
    );

    if (resetRequests.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    const email = resetRequests[0].email;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);

    // Delete used token
    await pool.query('DELETE FROM password_resets WHERE email = ?', [email]);

    res.json({ success: true, message: 'Password successfully reset. You can now log in.' });
  } catch (error) {
    console.error('RESET PASSWORD ERROR:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const getCurrentInviteCode = async (req, res) => {
  try {
    await ensureDynamicInvitesTable();
    const userId = req.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Limpeza atômica de códigos expirados no banco
    await pool.query('DELETE FROM dynamic_invites WHERE expires_at <= NOW()');

    // Tenta buscar um código ativo deste usuário
    const [existing] = await pool.query(
      'SELECT code, expires_at FROM dynamic_invites WHERE created_by = ? AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1',
      [userId]
    );

    if (existing.length > 0) {
      return res.json({ code: existing[0].code, expiresAt: existing[0].expires_at });
    }

    // Gera um novo código de 6 dígitos
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      'INSERT INTO dynamic_invites (code, created_by, expires_at) VALUES (?, ?, ?)',
      [newCode, userId, expiresAt]
    );

    res.json({ code: newCode, expiresAt });
  } catch (error) {
    console.error('Error fetching/generating invite code:', error);
    res.status(500).json({ error: 'Failed to generate invite code' });
  }
};
