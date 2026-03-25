import pool from '../config/db.js';

export const getPendingInvitations = async (req, res) => {
  try {
    const email = String(req.user_email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'email do usuário é obrigatório' });
    }

    // Tentar criar a tabela caso não exista para evitar erros em ambientes novos
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

    const [rows] = await pool.query(
      `SELECT wi.id, wi.workspace_id, wi.email, wi.status, wi.created_at, 
              w.name as workspace_name, u.name as inviter_name, u.email as inviter_email, u.avatar_url as inviter_avatar
       FROM workspace_invitations wi
       JOIN workspaces w ON wi.workspace_id = w.id
       JOIN users u ON wi.invited_by = u.id
       WHERE LOWER(wi.email) = LOWER(?) AND wi.status IN ('pending', 'dismissed')
       ORDER BY wi.created_at DESC`,
      [email]
    );

    res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar convites pendentes:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};

export const respondToInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept', 'decline', 'dismiss'
    const userId = req.user_id;
    const email = String(req.user_email || '').trim().toLowerCase();

    if (!id || !action) {
      return res.status(400).json({ error: 'ID e ação são obrigatórios' });
    }

    const [invites] = await pool.query(
      'SELECT * FROM workspace_invitations WHERE id = ? AND LOWER(email) = LOWER(?)',
      [id, email]
    );

    if (invites.length === 0) {
      return res.status(404).json({ error: 'Convite não encontrado ou não pertence a você' });
    }

    const invite = invites[0];

    if (action === 'accept') {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        
        // Adicionar ao workspace
        await connection.query(
          'INSERT IGNORE INTO workspace_members (workspace_id, user_id) VALUES (?, ?)',
          [invite.workspace_id, userId]
        );
        
        // Atualizar ou deletar o convite
        await connection.query(
          'UPDATE workspace_invitations SET status = ? WHERE id = ?',
          ['accepted', id]
        );

        await connection.commit();
        res.json({ success: true, message: 'Convite aceito' });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } else if (action === 'decline') {
      await pool.query('DELETE FROM workspace_invitations WHERE id = ?', [id]);
      res.json({ success: true, message: 'Convite recusado' });
    } else if (action === 'dismiss') {
      await pool.query('UPDATE workspace_invitations SET status = ? WHERE id = ?', ['dismissed', id]);
      res.json({ success: true, message: 'Convite ocultado (dismissed)' });
    } else {
      res.status(400).json({ error: 'Ação inválida' });
    }

  } catch (error) {
    console.error('Erro ao responder convite:', error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
};
