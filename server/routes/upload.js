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
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspace_id é obrigatório' });
    }

    // TODO: Salvar na tabela assets vinculando ao workspaceId se necessário

    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${file.filename}`;

    res.json({ url: fileUrl });
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({ error: 'Erro interno no servidor durante o upload' });
  }
});

export default router;
