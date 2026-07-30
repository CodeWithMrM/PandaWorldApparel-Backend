const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Storage abstraction so the rest of the app doesn't care whether files
 * end up on local disk or in the cloud. Swap STORAGE_DRIVER in .env and
 * implement the `cloud` branch (S3, Cloudinary, GCS, etc.) when ready.
 */
const storageService = {
  /**
   * Given a multer file object (already written to disk by diskStorage),
   * returns the public-facing URL to store on the Product record.
   */
  getPublicUrl(file) {
    if (!file) return null;

    if (env.storage.driver === 'local') {
      return `${env.appUrl}/uploads/${file.filename}`;
    }

    // --- CLOUD STORAGE STUB ---
    // Wire this up to your provider of choice, e.g.:
    //
    // const s3 = new S3Client({ region: process.env.AWS_REGION });
    // await s3.send(new PutObjectCommand({
    //   Bucket: process.env.AWS_BUCKET,
    //   Key: file.filename,
    //   Body: fs.createReadStream(file.path),
    //   ContentType: file.mimetype,
    // }));
    // return `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${file.filename}`;
    //
    // For now, fall back to the local URL so the app keeps working even
    // if STORAGE_DRIVER=cloud hasn't been implemented yet.
    // eslint-disable-next-line no-console
    console.warn(
      '[storage] STORAGE_DRIVER=cloud but no cloud implementation is wired up yet. ' +
        'Falling back to local URL. See src/services/storage.service.js'
    );
    return `${env.appUrl}/uploads/${file.filename}`;
  },

  /**
   * Deletes a previously uploaded file (used e.g. when a product image is
   * replaced or the product is deleted). Safe to call even if the file
   * doesn't exist.
   */
  async deleteByUrl(url) {
    if (!url) return;
    if (env.storage.driver !== 'local') {
      // --- CLOUD STORAGE STUB: implement provider-specific delete here ---
      return;
    }
    const filename = url.split('/uploads/')[1];
    if (!filename) return;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.promises.unlink(filePath).catch(() => {
      /* ignore if already gone */
    });
  },
};

module.exports = { storageService, UPLOAD_DIR };
