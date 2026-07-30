const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');
const { UPLOAD_DIR } = require('../services/storage.service');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Disk storage for local uploads. When STORAGE_DRIVER=cloud, the file is
 * still briefly written to disk by multer and then handed to
 * storageService, which is where you'd stream it up to S3/Cloudinary and
 * (optionally) delete the local temp copy.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only image files (jpeg, png, webp, gif) are allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.storage.maxUploadSizeMb * 1024 * 1024 },
});

// Single "image" field, used for product create/update
const uploadProductImage = upload.single('image');

module.exports = { uploadProductImage };
