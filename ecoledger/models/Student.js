/**
 * EcoLedger — Student Model
 * Location: ecoledger/models/Student.js
 */
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  email:         { type: String, required: true, unique: true },
  password:      { type: String, required: true },
  ecoPoints:     { type: Number, default: 0 },
  cctTokens:     { type: Number, default: 0 },   // ← ADDED
  role:          { type: String, enum: ['student', 'admin'], default: 'student' },
  walletAddress: { type: String, default: '' },   // auto-generated on register
});

module.exports = mongoose.model('Student', studentSchema);