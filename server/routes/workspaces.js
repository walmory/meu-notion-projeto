import express from 'express';
import { 
  getWorkspaces, 
  createWorkspace, 
  getWorkspaceMembers, 
  inviteMember, 
  removeMember, 
  deleteWorkspace, 
  inviteWorkspaceMember, 
  getPendingInvitationsCount,
  getMyInvites,
  acceptInvite,
  declineInvite,
  getWorkspacePendingInvites,
  cancelWorkspaceInvite
} from '../controllers/workspaceController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { workspaceMiddleware } from '../middleware/workspaceMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// Returns all user workspaces (does not require workspace_id)
router.get('/', getWorkspaces);
router.post('/', createWorkspace);
router.post('/:id/invite', inviteWorkspaceMember);
router.get('/:id/invites/pending', getWorkspacePendingInvites);
router.delete('/:id/invites/:inviteId', cancelWorkspaceInvite);
router.delete('/:id', deleteWorkspace);

// User invite routes (does not require workspaceMiddleware since user is not yet a member)
router.get('/my-invites', getMyInvites);
router.post('/invites/:inviteId/accept', acceptInvite);
router.post('/invites/:inviteId/decline', declineInvite);

// Rotas de membros (exigem workspace_id no header/body)
router.get('/members', workspaceMiddleware, getWorkspaceMembers);
router.get('/invitations/pending-count', workspaceMiddleware, getPendingInvitationsCount);
router.post('/members', workspaceMiddleware, inviteMember);
router.delete('/members/:email', workspaceMiddleware, removeMember);

export default router;
