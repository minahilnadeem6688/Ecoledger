const mongoose = require("mongoose");

const activityTypeSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true
  },

  points: {
    type: Number,
    required: true
  },

  description: String

});

module.exports = mongoose.model("ActivityType", activityTypeSchema);