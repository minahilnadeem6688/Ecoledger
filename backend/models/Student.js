/**
 * EcoLedger: Student model
 * Passwords are stored as bcrypt hashes and never leave the server.
 */
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:      { type: String, required: true },
  role:          { type: String, enum: ['student', 'admin'], default: 'student' },
  ecoPoints:     { type: Number, default: 0 },   // spendable in the rewards store
  cctTokens:     { type: Number, default: 0 },   // lifetime CCT minted on-chain
  walletAddress: { type: String, default: '' },
}, { timestamps: true });

studentSchema.set('toJSON', {
  transform: (_doc, ret) => { delete ret.password; delete ret.__v; return ret; },
});

module.exports = mongoose.model('Student', studentSchema);
