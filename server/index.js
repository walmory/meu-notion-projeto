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
import projectRoutes from './routes/projects.js';
import { initSocket } from './socket.js';

import path from 'path';

const PORT = Number(process.env.PORT || 3001);

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    // Permite se não houver origin (ex: apps mobile/curl) ou se vier da vercel.app
    if (!origin || origin.indexOf('vercel.app') !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS não permitido por segurança'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-id', 'Cache-Control', 'Pragma', 'expires'],
  credentials: true
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
app.use('/projects', projectRoutes);

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

httpServer.listen(PORT, () => {
  console.log(`Servidor ON na porta ${PORT}`);
});
