const express = require('express');
const multer = require('multer');
const { verifyToken } = require('../middleware/authMiddleware');
const storageService = require('../services/storage.service');

const router = express.Router();

const ALLOWED_TYPES = storageService.PUBLIC_FOLDERS;
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const sanitizeType = (rawType) => {
  const type = String(rawType || 'products').toLowerCase();
  return ALLOWED_TYPES.includes(type) ? type : null;
};

// memoryStorage, not diskStorage: the bytes go straight to R2, so nothing is
// ever written to the container filesystem. MAX_FILE_SIZE keeps the buffer small.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    return cb(null, true);
  },
});

// The type is validated before multer runs so an invalid one is rejected without
// buffering the upload at all.
const requireValidType = (req, res, next) => {
  const type = sanitizeType(req.query.type);
  if (!type) return res.status(400).json({ message: 'Invalid upload type' });
  req.uploadType = type;
  return next();
};

const storeFile = (file, folder) => storageService.putPublic({
  folder,
  fileName: storageService.randomFileName(file.originalname),
  body: file.buffer,
  contentType: file.mimetype,
});

router.post('/', verifyToken, requireValidType, upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file provided' });
  }

  try {
    const { url } = await storeFile(req.file, req.uploadType);
    return res.status(200).json({ url });
  } catch (error) {
    return next(error);
  }
});

router.post('/multiple', verifyToken, requireValidType, upload.array('files', 10), async (req, res, next) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ message: 'No files provided' });
  }

  try {
    const stored = await Promise.all(files.map((file) => storeFile(file, req.uploadType)));
    return res.status(200).json({ files: stored.map(({ url }) => ({ url })) });
  } catch (error) {
    return next(error);
  }
});

// Express only treats a middleware as an error handler when it declares four
// parameters - the previous three-argument version was never invoked, so multer
// errors fell through to the generic 500 handler.
router.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err && err.message === 'Invalid file type') {
    return res.status(400).json({ message: 'Invalid file type. Please upload an image.' });
  }

  console.error('Upload failed:', err);
  return res.status(500).json({ message: 'Upload failed' });
});

module.exports = router;
