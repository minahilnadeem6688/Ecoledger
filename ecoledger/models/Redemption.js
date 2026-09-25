const mongoose = require("mongoose");

const redemptionSchema = new mongoose.Schema({

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },

  rewardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reward",
    required: true
  },

  redeemedAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Redemption", redemptionSchema);