/**
 * Proof photo upload: kept in memory, then saved to MongoDB (see models/Proof.js).
 */
const multer = require('multer');

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Proof must be a JPG, PNG, WebP or HEIC image.'));
  },
});
