import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import pool from './config/db.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import workspaceRoutes from './routes/workspaces.js';
import teamspaceRoutes from './routes/teamspaces.js';
import documentRoutes from './routes/documents.js';
import meetingRoutes from './routes/meetings.js';
import uploadRoutes from './routes/upload.js';
import { initSocket } from './socket.js';

import path from 'path';

const PORT = Number(process.env.PORT || 3001);

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Pragma', 'Cache-Control', 'skip-browser-warning', 'x-workspace-id']
}));

app.use(express.json());

// Rota de teste direto de isolamento
app.get('/teste-direto', (req, res) => res.send('OK - Servidor Lendo Index'));

// Rotas Base / API
app.use('/user', userRoutes);
app.use('/auth', authRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/workspace', workspaceRoutes); // Alias para a rota usada no frontend
app.use('/teamspaces', teamspaceRoutes);
app.use('/documents', documentRoutes);
app.use('/meetings', meetingRoutes);
app.use('/upload', uploadRoutes);

const httpServer = createServer(app);

// Rotas Estáticas
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(500).json({ status: 'error' });
  }
});

initSocket(httpServer);

const ensureDatabaseIndexes = async () => {
  try {
    const [rows] = await pool.query(`SHOW INDEX FROM documents`);
    const indexNames = rows.map(r => r.Key_name);

    if (!indexNames.includes('idx_workspace_id')) {
      await pool.query('CREATE INDEX idx_workspace_id ON documents (workspace_id)');
      console.log('Índice idx_workspace_id criado.');
    }
    if (!indexNames.includes('idx_owner_id')) {
      await pool.query('CREATE INDEX idx_owner_id ON documents (owner_id)');
      console.log('Índice idx_owner_id criado.');
    }
    if (!indexNames.includes('idx_updated_at')) {
      await pool.query('CREATE INDEX idx_updated_at ON documents (updated_at DESC)');
      console.log('Índice idx_updated_at criado.');
    }
    if (!indexNames.includes('idx_user_id_doc')) {
      // Considerando que documentos em algumas queries dependem do user_id/owner_id, 
      // embora a coluna atual no schema seja owner_id. Vamos garantir que se houver user_id ela seja indexada
      try {
        await pool.query('CREATE INDEX idx_user_id_doc ON documents (user_id)');
        console.log('Índice idx_user_id_doc criado.');
      } catch (e) {
        // Ignora se a coluna não existir
      }
    }
    console.log('✅ Indexação Automática concluída (Performance AAA).');
  } catch (error) {
    console.error('⚠️ Falha ao criar índices automáticos:', error.message);
  }
};

httpServer.listen(PORT, async () => {
  console.log(`Servidor ON na porta ${PORT}`);
  await ensureDatabaseIndexes();
});
