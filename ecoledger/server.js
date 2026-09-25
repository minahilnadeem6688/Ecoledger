require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

const activityTypeRoutes = require("./routes/activityTypeRoutes");
const studentRoutes = require("./routes/studentRoutes");
const activityRoutes = require("./routes/activityRoutes");
const rewardRoutes = require("./routes/rewardRoutes");

const app = express();

connectDB();   // THIS LINE IS VERY IMPORTANT

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use("/api/rewards", rewardRoutes);
app.use("/api/activity-types", activityTypeRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/activity", activityRoutes);

app.get("/", (req, res) => {
  res.send("EcoLedger server running");
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});