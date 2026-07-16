const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const INSTALLATIONS_DIR = path.join(UPLOAD_ROOT, 'installations');
const VEHICLE_DOCUMENTS_DIR = path.join(UPLOAD_ROOT, 'vehicle-documents');
const MAX_PHOTOS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

function ensureUploadDirs() {
  fs.mkdirSync(INSTALLATIONS_DIR, { recursive: true });
  fs.mkdirSync(VEHICLE_DOCUMENTS_DIR, { recursive: true });
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

const vehicleDocumentStorage = multer.diskStorage({
  destination(req, file, cb) {
    ensureUploadDirs();
    const vehicleId = req.params.vehicleId || req.body?.vehicle_id || 'temp';
    const targetDir = path.join(VEHICLE_DOCUMENTS_DIR, String(vehicleId));
    fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function documentFileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Apenas PDF ou imagens (JPG, PNG, WebP) são permitidos.'));
  }
  cb(null, true);
}

const vehicleDocumentUpload = multer({
  storage: vehicleDocumentStorage,
  limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1 },
  fileFilter: documentFileFilter,
});

function storeVehicleDocumentFile(file, vehicleId) {
  if (!file) return null;
  const relative = path.relative(UPLOAD_ROOT, file.path).replace(/\\/g, '/');
  return {
    file_path: relative,
    original_filename: file.originalname,
  };
}

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
  MAX_DOCUMENT_SIZE,
  installationPhotosUpload,
  vehicleDocumentUpload,
  movePhotosToInstallation,
  storeVehicleDocumentFile,
  resolveUploadPath,
  ensureUploadDirs,
};
