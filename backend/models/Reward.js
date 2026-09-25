const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  title:          { type: String, required: true },
  description:    String,
  icon:           { type: String, default: 'gift' },
  pointsRequired: { type: Number, required: true, min: 1 },
  quantity:       { type: Number, default: 100, min: 0 },
});

module.exports = mongoose.model('Reward', rewardSchema);
