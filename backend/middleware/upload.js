/**
 * Proof photo upload: kept in memory, then saved to MongoDB (see models/Proof.js).
 */
const multer = require('multer');

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // under Vercel's 4.5 MB request limit
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Proof must be a JPG, PNG, WebP or HEIC image.'));
  },
});
