/**
 * EcoLedger — Activity Model
 * Location: ecoledger/models/Activity.js
 */
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  activityType: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivityType', required: true },
  description:  String,
  location:     String,
  proofImage:   String,
  verificationStatus: {
    type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending',
  },
  pointsEarned:    { type: Number, default: 0 },
  rejectionReason: { type: String, default: null },  // ← ADDED
  verifiedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('Activity', activitySchema);