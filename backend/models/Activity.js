/**
 * EcoLedger: Activity model
 * Points are set by the server from the activity type, never by the client.
 */
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  activityType: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivityType', required: true },
  description:  { type: String, trim: true },
  location:     { type: String, trim: true },
  proofImage:   String,
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  pointsEarned:    { type: Number, default: 0 },
  rejectionReason: { type: String, default: null },
  verifiedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  verifiedAt:  Date,
  // On-chain reward
  mintStatus:  { type: String, enum: ['none', 'minted', 'failed'], default: 'none' },
  mintTxHash:  { type: String, default: null },
  mintBlock:   { type: Number, default: null },
  mintError:   { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
