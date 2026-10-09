const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_TYPES[file.mimetype] || 'bin';
    cb(null, `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      const err = new Error('Unsupported image type');
      err.code = 'UNSUPPORTED_TYPE';
      return cb(err);
    }
    cb(null, true);
  }
});

module.exports = { upload, uploadDir, ALLOWED_TYPES };
