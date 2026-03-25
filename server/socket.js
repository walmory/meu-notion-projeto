import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import pool from './config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

let ioInstance = null;

const getWorkspaceRoom = (workspaceId) => String(workspaceId);
const getDocumentRoom = (documentId) => `document:${documentId}`;

// ─── DB Schema Bootstrap ────────────────────────────────────────────────────
let contentVersionReady = null;

const ensureContentVersionColumn = async () => {
  if (contentVersionReady !== null) return contentVersionReady;
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'documents'
         AND COLUMN_NAME = 'content_version'
       LIMIT 1`
    );
    if (!Array.isArray(cols) || cols.length === 0) {
      await pool.query(
        'ALTER TABLE documents ADD COLUMN content_version BIGINT NOT NULL DEFAULT 0'
      );
    }
    contentVersionReady = true;
  } catch {
    contentVersionReady = false;
  }
  return contentVersionReady;
};


// ─── Access Control ──────────────────────────────────────────────────────────
const canAccessWorkspace = async (workspaceId, userId) => {
  const [rows] = await pool.query(
    `SELECT w.id
     FROM workspaces w
     LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
     WHERE w.id = ?
       AND (w.owner_id = ? OR wm.user_id = ?)
     LIMIT 1`,
    [userId, workspaceId, userId, userId]
  );
  return rows.length > 0;
};

const canAccessDocument = async (documentId, userId) => {
  const [rows] = await pool.query(
    `SELECT d.id FROM documents d
     JOIN workspaces w ON w.id = d.workspace_id
     LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
     WHERE d.id = ?
       AND (w.owner_id = ? OR wm.user_id = ?)
       AND (d.is_public = 1 OR d.is_private = 0 OR (d.is_private = 1 AND d.owner_id = ?))
     LIMIT 1`,
    [userId, documentId, userId, userId, userId]
  );
  return rows.length > 0;
};

// ─── Per-Socket Per-Document Queue ──────────────────────────────────────────
// Each socket tracks its own lastProcessedSeq per document so that the
// monotonically-increasing seq counter is scoped to a single session.
// This prevents a freshly-connected session (seq=1) from being rejected
// because a previous session reached seq=1000.

function getDocQueue(socket, docId) {
  if (!socket.data.docQueues[docId]) {
    socket.data.docQueues[docId] = {
      lastProcessedSeq: -1,
      queue: [],
      processing: false,
    };
  }
  return socket.data.docQueues[docId];
}

async function processDocQueue(socket, docId) {
  const state = getDocQueue(socket, docId);
  if (state.processing || state.queue.length === 0) return;

  state.processing = true;
  
  // We only care about saving the LATEST state to the DB to save DB ops.
  // Take the last message in the queue and discard the rest.
  const msg = state.queue.pop();
  state.queue = []; // clear the queue since we skipped intermediate states

  // Discard stale messages (arrived late / out of order)
  if (msg.seq <= state.lastProcessedSeq) {
    state.processing = false;
    return;
  }

  const jsonContent =
    typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(Array.isArray(msg.content) ? msg.content : []);
  const titleValue = typeof msg.title === 'string' ? msg.title : null;
  const iconValue = msg.icon;
  const coverValue = msg.cover;

  try {
    const sql = `UPDATE documents
      SET title = COALESCE(?, title),
      content = ?,
      icon = COALESCE(?, icon),
      cover = COALESCE(?, cover),
      updated_at = NOW(3),
      content_version = content_version + 1
      WHERE id = ?
        AND (content_version IS NULL OR content_version <= ?)`;
    const values = [titleValue, jsonContent, iconValue, coverValue, docId, msg.contentVersion];

    const [result] = await pool.execute(sql, values);

    if (result.affectedRows === 0) {
      throw new Error('Database refused to save!');
    }

    state.lastProcessedSeq = msg.seq;

    // ACK: tells the frontend this seq has been persisted.
    socket.emit('content-ack', { docId, seq: msg.seq });

    let newContentVersion = msg.contentVersion;
    const [versionRows] = await pool.query(
      'SELECT content_version FROM documents WHERE id = ? LIMIT 1',
      [docId]
    );
    if (Array.isArray(versionRows) && versionRows.length > 0) {
      newContentVersion = Number(versionRows[0].content_version);
    }

    if (socket.data.workspaceId) {
      const workspaceId = getWorkspaceRoom(socket.data.workspaceId);
      const documentUpdatedPayload = {
        id: docId,
        title: titleValue ?? undefined,
        updated_at: new Date().toISOString(),
        content_version: newContentVersion
      };
      socket.broadcast.to(workspaceId).emit('document-updated', documentUpdatedPayload);
    }
  } catch (error) {
    socket.emit('save-error', {
      docId,
      seq: msg.seq,
      message: error?.message ? String(error.message) : 'Error saving',
    });
  }

  state.processing = false;
  if (state.queue.length > 0 && !state.timeoutId) {
    state.timeoutId = setTimeout(() => {
      state.timeoutId = null;
      processDocQueue(socket, docId);
    }, 2000);
  }
}

// ─── Socket Server ───────────────────────────────────────────────────────────
export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: function (origin, callback) {
        if (!origin || origin.indexOf('vercel.app') !== -1) {
          callback(null, true);
        } else {
          callback(new Error('CORS not allowed for security reasons'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
    },
  });

  // JWT authentication middleware
  ioInstance.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.data.userId = payload.user_id;
      socket.data.email = payload.email;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  ioInstance.on('connection', (socket) => {
    // Initialize per-socket queue store
    socket.data.docQueues = {};

    // Join personal email room for real-time invites
    if (socket.data.email) {
      socket.join(`user-email:${socket.data.email.toLowerCase()}`);
    }

    // ── Room management ──────────────────────────────────────────────────
    socket.on('join-workspace', async (workspaceId) => {
      if (!workspaceId) return;
      const ok = await canAccessWorkspace(workspaceId, socket.data.userId);
      if (!ok) return;
      socket.join(getWorkspaceRoom(workspaceId));
      socket.data.workspaceId = workspaceId;
    });

    socket.on('join-document', async (documentId) => {
      if (!documentId) return;
      const ok = await canAccessDocument(documentId, socket.data.userId);
      if (!ok) return;
      socket.join(getDocumentRoom(documentId));
      // Ensure DB column is ready before any writes start
      await ensureContentVersionColumn();
    });

    // ── Content sync (Atomic Sequence) ───────────────────────────────────
    const handleContentUpdate = (payload) => {
      const docId = payload?.docId;
      const content = payload?.content;
      const title = payload?.title;
      const icon = payload?.icon;
      const cover = payload?.cover;
      const seq = payload?.seq;
      const contentVersion = payload?.contentVersion || Date.now();

      // seq is mandatory — legacy payloads without it are rejected
      if (!docId || typeof seq !== 'number') return;

      // Room membership = proof of access (checked on join-document)
      if (!socket.rooms.has(getDocumentRoom(docId))) return;

      // IMMEDIATE BROADCAST FOR REAL-TIME TYPING
      let blocksToBroadcast = Array.isArray(content) ? content : null;
      if (!blocksToBroadcast && typeof content === 'string') {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) blocksToBroadcast = parsed;
        } catch { /* ignore parse errors */ }
      }
      
      if (blocksToBroadcast) {
        socket.broadcast.to(getDocumentRoom(docId)).emit('content-update', {
          senderId: socket.id,
          content: blocksToBroadcast,
          title: typeof title === 'string' ? title : undefined,
          icon: icon ?? undefined,
          cover: cover ?? undefined,
          contentVersion: contentVersion
        });
      }

      const state = getDocQueue(socket, docId);

      // Fast-path: discard immediately if this seq is already superseded
      if (seq <= state.lastProcessedSeq) return;

      state.queue.push({ seq, content, title, icon, cover, docId, contentVersion });
      
      // Throttle DB processing - instead of processing every keystroke immediately,
      // we can debounce it to save DB writes, but since we already broadcasted,
      // users see it instantly.
      if (!state.processing && !state.timeoutId) {
        state.timeoutId = setTimeout(() => {
          state.timeoutId = null;
          processDocQueue(socket, docId);
        }, 2000); // Save to DB every 2 seconds
      }
    };

    socket.on('update-content', handleContentUpdate);
    socket.on('content-change', handleContentUpdate); // backward compat alias

    socket.on('title-change', (payload) => {
      const docId = payload?.docId;
      const title = payload?.title;
      if (!docId || typeof title !== 'string') return;
      if (!socket.rooms.has(getDocumentRoom(docId))) return;
      socket.volatile.to(getDocumentRoom(docId)).emit('title-change', {
        senderId: socket.id,
        docId,
        title,
      });
    });

    socket.on('document:update-title', (payload) => {
      const docId = payload?.docId;
      const newTitle = payload?.newTitle;
      const workspaceId = payload?.workspaceId;
      if (!docId || typeof newTitle !== 'string' || !workspaceId) return;
      const workspaceRoom = getWorkspaceRoom(workspaceId);
      if (!socket.rooms.has(workspaceRoom)) return;
      console.log(`[UX-Sync] -> Documento ${docId} atualizado`);
      socket.broadcast.to(workspaceRoom).emit('document:update-title', {
        senderId: socket.id,
        workspaceId,
        docId,
        newTitle,
      });
    });

    socket.on('icon-change', (payload) => {
      const docId = payload?.docId;
      const icon = payload?.icon;
      if (!docId) return;
      if (icon !== null && typeof icon !== 'string') return;
      if (!socket.rooms.has(getDocumentRoom(docId))) return;
      socket.volatile.to(getDocumentRoom(docId)).emit('icon-change', {
        senderId: socket.id,
        docId,
        icon: icon ?? null,
      });
    });

    socket.on('cover-change', (payload) => {
      const docId = payload?.docId;
      const cover = payload?.cover;
      if (!docId) return;
      if (cover !== null && typeof cover !== 'string') return;
      if (!socket.rooms.has(getDocumentRoom(docId))) return;
      socket.volatile.to(getDocumentRoom(docId)).emit('cover-change', {
        senderId: socket.id,
        docId,
        cover: cover ?? null,
      });
    });

    // ── Presence / collaboration events ──────────────────────────────────
    socket.on('document-moving', (payload) => {
      if (!payload?.workspaceId || !payload?.documentId) return;
      socket.volatile
        .to(getWorkspaceRoom(payload.workspaceId))
        .emit('document-moving', {
          userId: socket.data.userId,
          userName: socket.data.email,
          documentId: payload.documentId,
          action: 'moving',
        });
    });

    socket.on('cursor-move', (payload) => {
      if (!payload?.docId) return;
      socket.volatile.to(getDocumentRoom(payload.docId)).emit('cursor-update', {
        ...payload,
        socketId: socket.id,
      });
    });

    socket.on('selection-change', (payload) => {
      if (!payload?.documentId || !payload?.position) return;
      socket.to(getDocumentRoom(payload.documentId)).emit('selection-change', {
        socketId: socket.id,
        userId: payload.userId || socket.data.userId,
        userName: payload.userName || socket.data.email || 'User',
        position: payload.position,
      });
    });

    socket.on('user-typing', (payload) => {
      if (!payload?.documentId) return;
      socket.to(getDocumentRoom(payload.documentId)).emit('user-typing', {
        socketId: socket.id,
        userId: payload.userId || socket.data.userId,
        userName: payload.userName || socket.data.email || 'User',
        isTyping: Boolean(payload.isTyping),
      });
    });

    socket.on('disconnect', () => {
      if (!socket.data.workspaceId) {
        return;
      }
      ioInstance.to(getWorkspaceRoom(socket.data.workspaceId)).emit('cursor-remove', socket.id);
    });
  });

  return ioInstance;
};

export const emitToWorkspace = (workspaceId, eventName, payload) => {
  if (!ioInstance || !workspaceId) return;
  ioInstance.to(getWorkspaceRoom(workspaceId)).emit(eventName, payload);
};

export const emitToUserEmail = (email, eventName, payload) => {
  if (!ioInstance || !email) return;
  ioInstance.to(`user-email:${email.toLowerCase()}`).emit(eventName, payload);
};

