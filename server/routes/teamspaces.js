import express from 'express';
import { getTeamspaces, createTeamspace, deleteTeamspace } from '../controllers/teamspaceController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { workspaceMiddleware } from '../middleware/workspaceMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(workspaceMiddleware);

router.get('/', getTeamspaces);
router.post('/', createTeamspace);
router.delete('/:id', deleteTeamspace);

export default router;
