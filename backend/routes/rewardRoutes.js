/**
 * EcoLedger: rewards store. Redeeming spends eco points; on-chain CCT stays as a
 * permanent record of what the student earned.
 */
const express = require('express');
const Reward = require('../models/Reward');
const Student = require('../models/Student');
const Redemption = require('../models/Redemption');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    res.json(await Reward.find().sort({ pointsRequired: 1 }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, icon, pointsRequired, quantity } = req.body;
    res.status(201).json(await Reward.create({ title, description, icon, pointsRequired, quantity }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/rewards/mine: redemption history
router.get('/mine', requireAuth, async (req, res) => {
  try {
    res.json(await Redemption.find({ studentId: req.user._id }).populate('rewardId', 'title icon pointsRequired').sort({ redeemedAt: -1 }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rewards/:id/redeem
router.post('/:id/redeem', requireAuth, async (req, res) => {
  try {
    const reward = await Reward.findById(req.params.id);
    if (!reward) return res.status(404).json({ error: 'Reward not found.' });

    // Conditional updates: never go below zero, even with two quick taps.
    const stock = await Reward.findOneAndUpdate({ _id: reward._id, quantity: { $gt: 0 } }, { $inc: { quantity: -1 } }, { new: true });
    if (!stock) return res.status(409).json({ error: 'This reward is out of stock.' });
    const student = await Student.findOneAndUpdate(
      { _id: req.user._id, ecoPoints: { $gte: reward.pointsRequired } },
      { $inc: { ecoPoints: -reward.pointsRequired } },
      { new: true },
    );
    if (!student) {
      await Reward.updateOne({ _id: reward._id }, { $inc: { quantity: 1 } });
      return res.status(400).json({ error: `You need ${reward.pointsRequired} points for this reward.` });
    }
    await Redemption.create({ studentId: student._id, rewardId: reward._id });
    res.json({ message: `Redeemed: ${reward.title}`, user: student, reward: stock });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
