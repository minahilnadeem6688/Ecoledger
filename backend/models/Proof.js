/**
 * EcoLedger: proof photo, stored in MongoDB so it survives restarts on hosts
 * with a temporary disk (Render, Railway, ...). Served by a random key, not the _id.
 */
const mongoose = require('mongoose');

const proofSchema = new mongoose.Schema({
  key:         { type: String, required: true, unique: true },
  data:        { type: Buffer, required: true },
  contentType: { type: String, required: true },
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
}, { timestamps: true });

module.exports = mongoose.model('Proof', proofSchema);
