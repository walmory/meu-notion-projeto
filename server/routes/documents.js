import express from 'express';
import {
  getDocuments,
  getDocumentById,
  getRecentDocuments,
  getPrivateDocuments,
  getTeamspaceDocuments,
  createDocument,
  updateDocument,
  moveDocument,
  toggleFavorite,
  deleteDocument,
  searchDocuments,
  duplicateDocument
} from '../controllers/documentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { workspaceMiddleware } from '../middleware/workspaceMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(workspaceMiddleware);
router.get('/search', searchDocuments);
router.get('/recent', getRecentDocuments);
router.get('/private', getPrivateDocuments);
router.get('/teamspace/:id', getTeamspaceDocuments);
router.get('/', getDocuments);
router.get('/:id', getDocumentById);
router.post('/', createDocument);
router.post('/duplicate/:id', duplicateDocument);
router.patch('/move', moveDocument);
router.patch('/:id/toggle-favorite', toggleFavorite);
router.patch('/:id/move', moveDocument);
router.patch('/:id', updateDocument);
router.delete('/:id', deleteDocument);

export default router;
