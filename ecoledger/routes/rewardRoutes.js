/**
 * EcoLedger — Reward Routes  (FIXED)
 * Location: ecoledger-backend/routes/rewardRoutes.js
 *
 * BUG E FIX: redeem route only deducted student.ecoPoints but NOT student.cctTokens.
 * After redemption the wallet would still show the old (inflated) token count.
 * Now both fields are deducted together atomically using $inc.
 */
const express    = require('express');
const router     = express.Router();

const Reward     = require('../models/Reward');
const Student    = require('../models/Student');
const Redemption = require('../models/Redemption');

// ─── Create reward (Admin) ────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
  try {
    const { title, description, pointsRequired, quantity } = req.body;
    const reward = new Reward({ title, description, pointsRequired, quantity });
    await reward.save();
    res.json({ message: 'Reward created', reward });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Get all rewards ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const rewards = await Reward.find();
    res.json(rewards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Redeem reward ────────────────────────────────────────────────────────────
router.post('/redeem', async (req, res) => {
  try {
    const { studentId, rewardId } = req.body;

    const student = await Student.findById(studentId);
    const reward  = await Reward.findById(rewardId);

    if (!student || !reward) {
      return res.status(404).json({ message: 'Student or reward not found' });
    }

    if (student.ecoPoints < reward.pointsRequired) {
      return res.json({ message: 'Not enough points' });
    }

    if (reward.quantity <= 0) {
      return res.json({ message: 'Reward out of stock' });
    }

    // BUG E FIX: deduct BOTH ecoPoints and cctTokens atomically
    await Student.findByIdAndUpdate(studentId, {
      $inc: {
        ecoPoints: -reward.pointsRequired,
        cctTokens: -reward.pointsRequired,
      }
    });

    await Reward.findByIdAndUpdate(rewardId, { $inc: { quantity: -1 } });

    const redemption = new Redemption({ studentId, rewardId });
    await redemption.save();

    console.log(`✅ Redeemed "${reward.title}" by student ${student.name} — -${reward.pointsRequired} pts`);

    res.json({ message: 'Reward redeemed successfully' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;