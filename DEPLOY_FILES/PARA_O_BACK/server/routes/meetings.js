import express from 'express';
import { createMeeting, deleteMeeting, getMeetings, updateMeeting } from '../controllers/meetingController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { workspaceMiddleware } from '../middleware/workspaceMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(workspaceMiddleware);

router.get('/', getMeetings);
router.post('/', createMeeting);
router.patch('/:id', updateMeeting);
router.delete('/:id', deleteMeeting);

export default router;
