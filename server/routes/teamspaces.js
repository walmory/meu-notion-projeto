import express from 'express';
import { getTeamspaces, createTeamspace, updateTeamspace, deleteTeamspace, getTeamspaceMembers } from '../controllers/teamspaceController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { workspaceMiddleware } from '../middleware/workspaceMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(workspaceMiddleware);

router.post('/', createTeamspace);
router.get('/', getTeamspaces);
router.patch('/:id', updateTeamspace);
router.put('/:id', updateTeamspace);
router.delete('/:id', deleteTeamspace);
router.get('/:id/members', getTeamspaceMembers);

export default router;
