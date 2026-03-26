import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { emitToWorkspace } from '../socket.js';

let documentContentVersionColumnReady = null;
let documentOwnerColumnReady = null;

const ensureDocumentContentVersionColumn = async () => {
  if (documentContentVersionColumnReady !== null) {
    return documentContentVersionColumnReady;
  }

  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'documents'
         AND COLUMN_NAME = 'content_version'
       LIMIT 1`
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      await pool.query(
        'ALTER TABLE documents ADD COLUMN content_version BIGINT NOT NULL DEFAULT 0'
      );
    }

    documentContentVersionColumnReady = true;
  } catch (error) {
    documentContentVersionColumnReady = false;
    throw error;
  }

  return documentContentVersionColumnReady;
};

const ensureDocumentOwnerColumn = async () => {
  if (documentOwnerColumnReady !== null) {
    return documentOwnerColumnReady;
  }

  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'documents'
         AND COLUMN_NAME = 'owner_id'
       LIMIT 1`
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      await pool.query(
        'ALTER TABLE documents ADD COLUMN owner_id VARCHAR(36) NULL'
      );
    }

    const [publicRows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'documents'
         AND COLUMN_NAME = 'is_public'
       LIMIT 1`
    );

    if (!Array.isArray(publicRows) || publicRows.length === 0) {
      await pool.query(
        'ALTER TABLE documents ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0'
      );
    }

    documentOwnerColumnReady = true;
  } catch (error) {
    documentOwnerColumnReady = false;
    throw error;
  }

  return documentOwnerColumnReady;
};

const normalizeDocumentVisuals = (document) => {
  if (!document) {
    return document;
  }

  const normalizedIcon = document.icon ?? null;
  const normalizedCover = document.cover ?? null;

  return {
    ...document,
    icon: normalizedIcon,
    cover: normalizedCover,
  };
};

export const searchDocuments = async (req, res) => {
  const workspaceId = req.workspace_id;
  const { q } = req.query;
  const normalizedQuery = typeof q === 'string' ? q.trim() : '';

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  if (!normalizedQuery) {
    return res.json([]);
  }

  try {
    const searchTerm = `%${normalizedQuery}%`;
    const [documents] = await pool.query(
      `SELECT id, title, icon FROM documents
       WHERE workspace_id = ?
         AND title LIKE ?
         AND is_trash = 0
       LIMIT 10`,
      [workspaceId, searchTerm]
    );

    return res.json(documents);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch documents', details: error.message });
  }
};

export const getDocuments = async (req, res) => {
  const workspaceId = req.workspace_id;
  const userId = req.user_id;
  const trashOnly = req.query.trash === 'true';

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    await ensureDocumentOwnerColumn();
    await pool.query(
      `UPDATE documents d
       JOIN workspaces w ON w.id = d.workspace_id
       SET d.owner_id = w.owner_id
       WHERE d.workspace_id = ?
         AND d.owner_id IS NULL`,
      [workspaceId]
    );

    const [documents] = trashOnly
      ? await pool.query(
        `SELECT id, title, icon, cover, parent_id, updated_at, type, is_public
         FROM documents
         WHERE workspace_id = ?
           AND is_trash = 1
           AND (is_public = 1 OR is_private = 0 OR (is_private = 1 AND owner_id = ?))
         ORDER BY updated_at DESC`,
        [workspaceId, userId]
      )
      : await pool.query(
        `SELECT id, title, icon, cover, parent_id, is_favorite, updated_at, is_trash, is_private, teamspace_id, is_meeting_note, type, is_public
         FROM documents
         WHERE workspace_id = ?
           AND is_trash = 0
           AND (is_public = 1 OR is_private = 0 OR (is_private = 1 AND owner_id = ?))
         ORDER BY updated_at DESC`,
        [workspaceId, userId]
      );

    const normalizedDocuments = Array.isArray(documents)
      ? documents.map((document) => normalizeDocumentVisuals(document))
      : [];

    return res.json(normalizedDocuments);
  } catch (err) {
    if (trashOnly) {
      console.error('Error in Trash:', err);
    }
    return res.status(500).json({ error: 'Failed to fetch documents', details: err.message });
  }
};

export const getDocumentById = async (req, res) => {
  const workspaceId = req.workspace_id;
  const userId = req.user_id;
  const { id } = req.params;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    await ensureDocumentOwnerColumn();
    const [documents] = await pool.query(
      `SELECT id, title, content, workspace_id, icon, cover, content_version, updated_at, parent_id, is_favorite, is_trash, is_private, teamspace_id, is_meeting_note, type, is_public
       FROM documents
       WHERE id = ? AND workspace_id = ?
         AND (is_public = 1 OR is_private = 0 OR (is_private = 1 AND owner_id = ?))
       LIMIT 1`,
      [id, workspaceId, userId]
    );

    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];
    let normalizedContent = document.content;

    if (typeof document.content === 'string') {
      try {
        normalizedContent = JSON.parse(document.content);
      } catch {
        normalizedContent = document.content;
      }
    }

    return res.json(normalizeDocumentVisuals({
      ...document,
      content: normalizedContent,
    }));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch document', details: error.message });
  }
};

export const getPrivateDocuments = async (req, res) => {
  const workspaceId = req.workspace_id;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    const [documents] = await pool.query(
      `SELECT * FROM documents
       WHERE workspace_id = ?
         AND (is_trash = 0 OR is_trash IS NULL)
         AND is_private = 1
         AND teamspace_id IS NULL
       ORDER BY updated_at DESC`,
      [workspaceId]
    );

    return res.json(documents);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch documents privados', details: error.message });
  }
};

export const getTeamspaceDocuments = async (req, res) => {
  const workspaceId = req.workspace_id;
  const { id: teamspaceId } = req.params;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  if (!teamspaceId) {
    return res.status(400).json({ error: 'teamspace_id is required' });
  }

  try {
    const [documents] = await pool.query(
      `SELECT * FROM documents
       WHERE workspace_id = ?
         AND teamspace_id = ?
         AND (is_trash = 0 OR is_trash IS NULL)
       ORDER BY updated_at DESC`,
      [workspaceId, teamspaceId]
    );

    return res.json(documents);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch documents do teamspace', details: error.message });
  }
};

export const getRecentDocuments = async (req, res) => {
  const workspaceId = req.workspace_id;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    const [documents] = await pool.query(
      `SELECT id, title, icon, updated_at, is_trash
       FROM documents
       WHERE workspace_id = ? AND (is_trash = 0 OR is_trash IS NULL)
       ORDER BY updated_at DESC
       LIMIT 5`,
      [workspaceId]
    );

    return res.json(documents);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch documents recentes', details: error.message });
  }
};

export const createDocument = async (req, res) => {
  const workspaceId = req.workspace_id;
  const ownerId = req.user_id;
  const { title = '', content = '', parent_id = null, teamspace_id = null, is_meeting_note } = req.body;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    await ensureDocumentOwnerColumn();
    if (is_meeting_note !== true && teamspace_id) {
      const [teamspaceRows] = await pool.query(
        'SELECT id FROM teamspaces WHERE id = ? AND workspace_id = ? LIMIT 1',
        [teamspace_id, workspaceId]
      );
      if (teamspaceRows.length === 0) {
        return res.status(404).json({ error: 'Teamspace not found in the given workspace' });
      }
    }

    const documentId = req.body.id || uuidv4();
    const shouldBeMeetingNote = is_meeting_note === true;
    const normalizedTeamspaceId = shouldBeMeetingNote ? null : teamspace_id;
    const normalizedParentId = shouldBeMeetingNote ? null : parent_id;
    const isPrivate = shouldBeMeetingNote ? 0 : (normalizedTeamspaceId ? 0 : 1);
    const normalizedTitle = typeof title === 'string' ? title : '';
    const docContent = content ?? '[]';
    const contentForInsert = typeof docContent === 'string' ? docContent : JSON.stringify(docContent);
    const initialContentVersion = 0;
    const docType = req.body.type || 'page';

    await pool.query(
      `INSERT INTO documents (id, title, content, content_version, parent_id, workspace_id, teamspace_id, is_private, is_meeting_note, owner_id, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [documentId, normalizedTitle, contentForInsert, initialContentVersion, normalizedParentId, workspaceId, normalizedTeamspaceId, isPrivate, shouldBeMeetingNote ? 1 : 0, ownerId, 'page']
    );

    const [documents] = await pool.query(
      'SELECT * FROM documents WHERE id = ? AND workspace_id = ? LIMIT 1',
      [documentId, workspaceId]
    );

    const mainDocument = documents[0];

    emitToWorkspace(workspaceId, 'document_created', mainDocument);

    return res.status(201).json(mainDocument);
  } catch (error) {
    console.error(error);
    console.error('Error creating document:', {
      message: error?.message,
      code: error?.code,
      sqlState: error?.sqlState,
      sqlMessage: error?.sqlMessage,
      stack: error?.stack,
      payload: req.body
    });
    return res.status(500).json({ error: 'Failed to create document', details: error.message });
  }
};

export const duplicateDocument = async (req, res) => {
  const workspaceId = req.workspace_id;
  const ownerId = req.user_id;
  const { id } = req.params;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT * FROM documents WHERE id = ? AND workspace_id = ? LIMIT 1',
      [id, workspaceId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Original document not found' });
    }

    const original = existing[0];
    const newId = uuidv4();
    const newTitle = original.title ? `Cópia de ${original.title}` : 'Cópia de Untitled';

    await pool.query(
      `INSERT INTO documents (id, title, content, content_version, parent_id, workspace_id, teamspace_id, is_private, is_meeting_note, owner_id, icon, cover, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId, 
        newTitle, 
        original.content, 
        0, 
        original.parent_id, 
        workspaceId, 
        original.teamspace_id, 
        original.is_private, 
        original.is_meeting_note, 
        ownerId,
        original.icon,
        original.cover,
        original.type || 'page'
      ]
    );

    const [newDocs] = await pool.query(
      'SELECT * FROM documents WHERE id = ? AND workspace_id = ? LIMIT 1',
      [newId, workspaceId]
    );

    emitToWorkspace(workspaceId, 'document_created', newDocs[0]);
    return res.status(201).json(newDocs[0]);
  } catch (error) {
    console.error('Error duplicating document:', error);
    return res.status(500).json({ error: 'Failed to duplicate document', details: error.message });
  }
};

export const updateDocument = async (req, res) => {
  const { id } = req.params;
  const workspaceId = req.workspace_id;
  const userId = req.user_id;
  const {
    title,
    content,
    icon,
    cover,
    content_version,
    is_favorite,
    teamspace_id,
    is_private,
    parent_id,
    is_meeting_note,
    is_trash,
    type,
    is_public
  } = req.body;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  const shouldBeMeetingNote = is_meeting_note === true || is_meeting_note === 1;
  let updateQuery = '';
  let updateValues = [];

  if (
    title === undefined
    && content === undefined
    && icon === undefined
    && cover === undefined
    && content_version === undefined
    && is_favorite === undefined
    && teamspace_id === undefined
    && is_private === undefined
    && parent_id === undefined
    && is_meeting_note === undefined
    && is_trash === undefined
    && type === undefined
    && is_public === undefined
  ) {
    console.error('Validation failed in updateDocument: no allowed fields sent', {
      payload: req.body,
      documentId: id,
      workspaceId
    });
    return res.status(400).json({
      error: 'Provide at least one field to update',
      details: 'Validation failed: at least one updatable field is required'
    });
  }

  try {
    await ensureDocumentContentVersionColumn();
    await ensureDocumentOwnerColumn();

    const iconValue = icon;
    const hasTitleUpdate = title !== undefined;
    const hasContentUpdate = content !== undefined;
    const hasIconUpdate = iconValue !== undefined;
    const hasCoverUpdate = cover !== undefined;
    const rawContentVersion = Number(content_version);
    const hasProvidedContentVersion = content_version !== undefined
      && content_version !== null
      && Number.isFinite(rawContentVersion);
    const shouldUseVersionGuard = hasContentUpdate || hasProvidedContentVersion;
    const clientContentVersion = hasProvidedContentVersion
      ? rawContentVersion
      : Date.now();

    if (hasIconUpdate) {
      console.log('[emoji][in][backend]', {
        documentId: id,
        workspaceId,
        icon: iconValue,
        resolvedIcon: iconValue
      });
    }

    const [existing] = await pool.query(
      `SELECT id
       FROM documents
       WHERE id = ? AND workspace_id = ?
         AND (is_private = 0 OR (is_private = 1 AND owner_id = ?))
       LIMIT 1`,
      [id, workspaceId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Document not found or unauthorized' });
    }

    if (!shouldBeMeetingNote && teamspace_id !== undefined && teamspace_id !== null) {
      const [teamspaceRows] = await pool.query(
        'SELECT id FROM teamspaces WHERE id = ? AND workspace_id = ? LIMIT 1',
        [teamspace_id, workspaceId]
      );

      if (teamspaceRows.length === 0) {
        return res.status(404).json({ error: 'Teamspace not found in the given workspace' });
      }
    }

    const fields = [
      'title = CASE WHEN ? THEN ? ELSE title END',
      'content = CASE WHEN ? THEN ? ELSE content END'
    ];
    const values = [
      hasTitleUpdate, hasTitleUpdate ? title : null,
      hasContentUpdate, null
    ];

    if (is_meeting_note !== undefined) {
      fields.push('is_meeting_note = ?');
      values.push(shouldBeMeetingNote ? 1 : 0);

      if (shouldBeMeetingNote) {
        fields.push('is_private = ?');
        values.push(0);
        fields.push('teamspace_id = ?');
        values.push(null);
        fields.push('parent_id = ?');
        values.push(null);
      }
    }

    if (hasContentUpdate) {
      let contentForUpdate = content;
      if (typeof content !== 'string') {
        contentForUpdate = JSON.stringify(content);
      }
      values[3] = contentForUpdate;
    }

    fields.push('icon = CASE WHEN ? THEN ? ELSE icon END');
    values.push(hasIconUpdate, hasIconUpdate ? iconValue : null);

    fields.push('cover = CASE WHEN ? THEN ? ELSE cover END');
    values.push(hasCoverUpdate, hasCoverUpdate ? cover : null);

    if (is_favorite !== undefined) {
      fields.push('is_favorite = ?');
      values.push(is_favorite);
    }

    if (type !== undefined) {
      fields.push('type = ?');
      values.push(type);
    }

    if (is_trash !== undefined) {
      fields.push('is_trash = ?');
      values.push(is_trash === true || is_trash === 1 ? 1 : 0);
    }

    if (is_public !== undefined) {
      fields.push('is_public = ?');
      values.push(is_public === true || is_public === 1 ? 1 : 0);
    }

    if (!shouldBeMeetingNote && teamspace_id !== undefined) {
      fields.push('teamspace_id = ?');
      values.push(teamspace_id);

      if (teamspace_id === null) {
        fields.push('is_private = ?');
        values.push(1);
      } else if (is_private === undefined) {
        fields.push('is_private = ?');
        values.push(0);
      }
    }

    if (!shouldBeMeetingNote && is_private !== undefined && teamspace_id !== null) {
      fields.push('is_private = ?');
      values.push(is_private);
    }

    if (!shouldBeMeetingNote && parent_id !== undefined) {
      fields.push('parent_id = ?');
      values.push(parent_id);
    }

    if (shouldUseVersionGuard) {
      updateQuery = `UPDATE documents
       SET ${fields.join(', ')}, updated_at = NOW(3), content_version = content_version + 1
       WHERE id = ? AND workspace_id = ?
         AND (content_version IS NULL OR content_version <= ?)`;
      values.push(id, workspaceId, clientContentVersion);
    } else {
      updateQuery = `UPDATE documents
       SET ${fields.join(', ')}, updated_at = NOW(3)
       WHERE id = ? AND workspace_id = ?`;
      values.push(id, workspaceId);
    }
    updateValues = values;

    const [updateResult] = await pool.query(updateQuery, values);

    if (updateResult.affectedRows === 0) {
      if (shouldUseVersionGuard) {
        return res.status(409).json({ error: 'Update discarded due to outdated content version' });
      }
      const [existingDocument] = await pool.query(
        `SELECT *
         FROM documents
         WHERE id = ? AND workspace_id = ?
           AND (is_private = 0 OR (is_private = 1 AND owner_id = ?))
         LIMIT 1`,
        [id, workspaceId, userId]
      );
      if (!Array.isArray(existingDocument) || existingDocument.length === 0) {
        return res.status(404).json({ error: 'Document not found or unauthorized' });
      }
      return res.status(200).json(normalizeDocumentVisuals(existingDocument[0]));
    }

    const [documents] = await pool.query(
      `SELECT *
       FROM documents
       WHERE id = ? AND workspace_id = ?
         AND (is_private = 0 OR (is_private = 1 AND owner_id = ?))
       LIMIT 1`,
      [id, workspaceId, userId]
    );

    const updatedDocument = normalizeDocumentVisuals(documents[0]);

    if (hasIconUpdate) {
      console.log('[emoji][out][backend]', {
        documentId: id,
        workspaceId,
        icon: updatedDocument?.icon
      });
    }
    
    if (teamspace_id !== undefined || parent_id !== undefined || is_private !== undefined || is_meeting_note !== undefined || is_trash !== undefined || is_public !== undefined) {
      emitToWorkspace(workspaceId, 'document_moved', updatedDocument);
    } else {
      emitToWorkspace(workspaceId, 'document_updated', updatedDocument);
    }

    return res.status(200).json(updatedDocument);
  } catch (error) {
    console.error('Error updating document:', {
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      sqlMessage: error?.sqlMessage,
      stack: error?.stack,
      payload: req.body,
      workspaceId,
      documentId: id,
      updateQuery,
      updateValues
    });
    return res.status(500).json({ error: 'Failed to update document', details: error.message });
  }
};

export const moveDocument = async (req, res) => {
  const workspaceId = req.workspace_id;
  const documentId = req.body.documentId || req.params.id;
  const targetTeamspaceId = req.body.targetTeamspaceId || req.body.teamspace_id;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  if (!documentId) {
    return res.status(400).json({ error: 'documentId is required to move document' });
  }

  if (targetTeamspaceId === undefined) {
    return res.status(400).json({ error: 'targetTeamspaceId is required to move document' });
  }

  try {
    if (targetTeamspaceId !== null) {
      const [teamspaceRows] = await pool.query(
        'SELECT id FROM teamspaces WHERE id = ? AND workspace_id = ? LIMIT 1',
        [targetTeamspaceId, workspaceId]
      );
      if (teamspaceRows.length === 0) {
        return res.status(404).json({ error: 'Teamspace not found in the given workspace' });
      }
    }

    const [existing] = await pool.query(
      'SELECT id FROM documents WHERE id = ? AND workspace_id = ? LIMIT 1',
      [documentId, workspaceId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await pool.query(
      `UPDATE documents
       SET teamspace_id = ?, is_private = ?, parent_id = NULL, updated_at = NOW()
       WHERE id = ? AND workspace_id = ?`,
      [targetTeamspaceId, targetTeamspaceId === null ? 1 : 0, documentId, workspaceId]
    );

    const [documents] = await pool.query(
      'SELECT * FROM documents WHERE id = ? AND workspace_id = ? LIMIT 1',
      [documentId, workspaceId]
    );

    const movedDocument = documents[0];
    emitToWorkspace(workspaceId, 'document_moved', movedDocument);
    return res.json(movedDocument);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to move document', details: error.message });
  }
};

export const toggleFavorite = async (req, res) => {
  const workspaceId = req.workspace_id;
  const { id } = req.params;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id, is_favorite FROM documents WHERE id = ? AND workspace_id = ? LIMIT 1',
      [id, workspaceId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const newFavoriteStatus = existing[0].is_favorite === 1 ? 0 : 1;

    await pool.query(
      'UPDATE documents SET is_favorite = ?, updated_at = NOW() WHERE id = ? AND workspace_id = ?',
      [newFavoriteStatus, id, workspaceId]
    );

    const [documents] = await pool.query(
      'SELECT * FROM documents WHERE id = ? AND workspace_id = ? LIMIT 1',
      [id, workspaceId]
    );

    const updatedDocument = documents[0];
    emitToWorkspace(workspaceId, 'document_updated', updatedDocument);
    return res.json(updatedDocument);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to favorite document', details: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  const workspaceId = req.workspace_id;
  const { id } = req.params;

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id, is_trash FROM documents WHERE id = ? AND workspace_id = ? LIMIT 1',
      [id, workspaceId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!(existing[0].is_trash === 1 || existing[0].is_trash === true)) {
      return res.status(400).json({ error: 'Document must be in trash to be permanently deleted' });
    }

    const [result] = await pool.query(
      'DELETE FROM documents WHERE id = ? AND workspace_id = ?',
      [id, workspaceId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    emitToWorkspace(workspaceId, 'document_deleted', { id });

    return res.json({ success: true, message: 'Document deleted permanently' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete document', details: error.message });
  }
};
