const mongoose = require('mongoose');

const activityTypeSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  points:      { type: Number, required: true, min: 1 },
  icon:        { type: String, default: 'leaf' },
  description: String,
});

module.exports = mongoose.model('ActivityType', activityTypeSchema);
