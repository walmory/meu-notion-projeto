import express from 'express';
import { getWorkspaces, createWorkspace, getWorkspaceMembers, inviteMember, removeMember, deleteWorkspace, inviteWorkspaceMember, getPendingInvitationsCount } from '../controllers/workspaceController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { workspaceMiddleware } from '../middleware/workspaceMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// Retorna todos os workspaces do usuário (não exige workspace_id)
router.get('/', getWorkspaces);
router.post('/', createWorkspace);
router.post('/:id/invite', inviteWorkspaceMember);
router.delete('/:id', deleteWorkspace);

// Rotas de membros (exigem workspace_id no header/body)
router.get('/members', workspaceMiddleware, getWorkspaceMembers);
router.get('/invitations/pending-count', workspaceMiddleware, getPendingInvitationsCount);
router.post('/members', workspaceMiddleware, inviteMember);
router.delete('/members/:email', workspaceMiddleware, removeMember);

export default router;
