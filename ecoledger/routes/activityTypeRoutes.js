const express = require('express');
const ActivityType = require('../models/ActivityType');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/activity-types
router.get('/', async (_req, res) => {
  try {
    res.json(await ActivityType.find().sort({ points: -1 }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/activity-types (admin)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, points, icon, description } = req.body;
    if (!name || !(Number(points) > 0)) return res.status(400).json({ error: 'Name and a positive point value are required.' });
    res.status(201).json(await ActivityType.create({ name, points: Number(points), icon, description }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
