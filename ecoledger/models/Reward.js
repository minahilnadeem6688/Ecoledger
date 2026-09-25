const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema({

  title: {
    type: String,
    required: true
  },

  description: {
    type: String
  },

  pointsRequired: {
    type: Number,
    required: true
  },

  quantity: {
    type: Number,
    default: 100
  }

});

module.exports = mongoose.model("Reward", rewardSchema);