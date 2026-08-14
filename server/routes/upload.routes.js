const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

const ALLOWED_TYPES = ['products', 'avatars', 'categories', 'brands', 'misc', 'shops'];
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ensureUploadDir = (type) => {
  const baseDir = path.join(__dirname, '..', 'uploads');
  const targetDir = path.join(baseDir, type);

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  return targetDir;
};

const sanitizeType = (rawType) => {
  const type = String(rawType || 'products').toLowerCase();
  return ALLOWED_TYPES.includes(type) ? type : null;
};

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const type = sanitizeType(req.query.type);
    if (!type) {
      return cb(new Error('Invalid upload type'));
    }
    req.uploadType = type;
    return cb(null, ensureUploadDir(type));
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    return cb(null, true);
  },
});

const toPublicUrl = (req, type, filename) => `${req.protocol}://${req.get('host')}/uploads/${type}/${filename}`;

router.post('/', verifyToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file provided' });
  }

  const type = req.uploadType || sanitizeType(req.query.type) || 'products';
  return res.status(200).json({ url: toPublicUrl(req, type, req.file.filename) });
});

router.post('/multiple', verifyToken, upload.array('files', 10), (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ message: 'No files provided' });
  }

  const type = req.uploadType || sanitizeType(req.query.type) || 'products';
  return res.status(200).json({
    files: files.map((file) => ({ url: toPublicUrl(req, type, file.filename) })),
  });
});

router.use((err, _req, res) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err && err.message === 'Invalid upload type') {
    return res.status(400).json({ message: 'Invalid upload type' });
  }

  if (err && err.message === 'Invalid file type') {
    return res.status(400).json({ message: 'Invalid file type. Please upload an image.' });
  }

  return res.status(500).json({ message: 'Upload failed' });
});

module.exports = router;
