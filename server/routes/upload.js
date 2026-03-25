import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), 'public/uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}-${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

router.post('/', upload.single('file'), (req, res) => {
  try {
    const file = req.file;
    const workspaceId = req.body.workspace_id || req.headers['x-workspace-id'] || req.headers['workspace_id'] || req.headers['workspace-id'];

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    // TODO: Save in assets table linking to workspaceId if needed

    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${file.filename}`;

    res.json({ url: fileUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error during upload' });
  }
});

export default router;
