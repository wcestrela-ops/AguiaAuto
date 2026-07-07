const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const INSTALLATIONS_DIR = path.join(UPLOAD_ROOT, 'installations');
const MAX_PHOTOS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function ensureUploadDirs() {
  fs.mkdirSync(INSTALLATIONS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    ensureUploadDirs();
    const tempDir = path.join(INSTALLATIONS_DIR, 'temp');
    fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function imageFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Apenas imagens são permitidas.'));
  }
  cb(null, true);
}

const installationPhotosUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_PHOTOS },
  fileFilter: imageFilter,
});

function movePhotosToInstallation(tempFiles, installationLogId) {
  const targetDir = path.join(INSTALLATIONS_DIR, String(installationLogId));
  fs.mkdirSync(targetDir, { recursive: true });

  return tempFiles.map((file, index) => {
    const dest = path.join(targetDir, file.filename);
    fs.renameSync(file.path, dest);
    return {
      file_path: path.relative(UPLOAD_ROOT, dest).replace(/\\/g, '/'),
      original_filename: file.originalname,
      sort_order: index,
    };
  });
}

function resolveUploadPath(relativePath) {
  const full = path.resolve(UPLOAD_ROOT, relativePath);
  if (!full.startsWith(path.resolve(UPLOAD_ROOT))) {
    throw new Error('Caminho de arquivo inválido.');
  }
  return full;
}

module.exports = {
  UPLOAD_ROOT,
  MAX_PHOTOS,
  installationPhotosUpload,
  movePhotosToInstallation,
  resolveUploadPath,
  ensureUploadDirs,
};
