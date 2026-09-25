const express = require("express");
const router = express.Router();

const ActivityType = require("../models/ActivityType");

/*
Create activity type (admin)
*/

router.post("/create", async (req, res) => {

  const activityType = new ActivityType(req.body);

  await activityType.save();

  res.json({ message: "Activity type created" });

});


/*
Get activity types
*/

router.get("/", async (req, res) => {

  const types = await ActivityType.find();

  res.json(types);

});

module.exports = router;