import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import pool from './config/db.js';

import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import teamspaceRoutes from './routes/teamspaces.js';
import documentRoutes from './routes/documents.js';
import meetingRoutes from './routes/meetings.js';
import uploadRoutes from './routes/upload.js';
import { initSocket } from './socket.js';

import path from 'path';

const PORT = Number(process.env.PORT || 3001);

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));
const httpServer = createServer(app);

// Rotas
app.use('/auth', authRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/workspace', workspaceRoutes); // Alias para a rota usada no frontend
app.use('/teamspaces', teamspaceRoutes);
app.use('/documents', documentRoutes);
app.use('/meetings', meetingRoutes);
app.use('/upload', uploadRoutes);

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
