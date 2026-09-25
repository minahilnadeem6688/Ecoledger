/**
 * EcoLedger — Activity Routes  (FIXED)
 * Location: ecoledger-backend/routes/activityRoutes.js
 *
 * This is the SINGLE place that handles approval logic.
 * The frontend store NO LONGER does its own point update or minting —
 * it just calls this endpoint and reads the result.
 *
 * FIXES IN THIS FILE:
 *
 * FIX 1: POST /activity/add — was returning { message: "..." } with no _id.
 *   The app couldn't map local activities to backend records so /verify/:id
 *   was always called with a local timestamp ID that didn't exist in MongoDB.
 *   Now returns the full populated activity including _id.
 *
 * FIX 2: GET /activity/ — was returning a plain text string instead of an array.
 *   Admin panel received "Activity route working" and showed nothing.
 *   Now returns all activities with student + activityType populated.
 *
 * FIX 3: activityType resolution — app sends a string name ("Recycling") but
 *   schema expects an ObjectId. Route now looks up or auto-creates the type.
 *
 * FIX 10: POST /activity/verify/:id — was ignoring rejectionReason.
 *   Also returns blockchainMinted: true/false so the frontend can show the
 *   correct success message without guessing.
 */
const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');

const ActivityType   = require('../models/ActivityType');
const Activity       = require('../models/Activity');
const Student        = require('../models/Student');
const upload         = require('../middleware/upload');
const { mintTokens } = require('../config/blockchain');

console.log('Activity routes loaded');

// ─── GET /activity/ (admin — all activities) ──────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate('studentId',    'name email walletAddress')
      .populate('activityType', 'name points')
      .sort({ createdAt: -1 });

    // Filter out ghost/broken records where activityType or student
    // didn't populate (old test data with stale ObjectIds → shows as "Unknown")
    const clean = activities.filter(a =>
      a.activityType && a.activityType.name &&
      a.studentId    && a.studentId.name
    );

    res.json(clean);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /activity/add ───────────────────────────────────────────────────────
router.post('/add', upload.single('proofImage'), async (req, res) => {
  console.log('POST /activity/add BODY:', req.body);

  try {
    const { studentId, activityType, points, description, location } = req.body;

    // Resolve activityType name → ObjectId
    let activityTypeId;
    if (mongoose.Types.ObjectId.isValid(activityType)) {
      activityTypeId = activityType;
    } else {
      let typeDoc = await ActivityType.findOne({
        name: { $regex: new RegExp(`^${activityType}$`, 'i') }
      });
      if (!typeDoc) {
        const pointsMap = {
          'Recycling': 20, 'Tree Plantation': 25, 'Clean Transport': 15,
          'Energy Saving': 10, 'Water Conservation': 12, 'Composting': 18,
          'Beach Clean-up': 30, 'Other': 8,
        };
        typeDoc = new ActivityType({
          name:   activityType,
          points: pointsMap[activityType] ?? Number(points) ?? 8,
        });
        await typeDoc.save();
        console.log('Auto-created ActivityType:', activityType);
      }
      activityTypeId = typeDoc._id;
    }

    const activity = new Activity({
      studentId,
      activityType:       activityTypeId,
      description,
      location,
      pointsEarned:       Number(points) || 0,
      proofImage:         req.file ? req.file.filename : null,
      verificationStatus: 'pending',
    });
    await activity.save();

    const populated = await Activity.findById(activity._id)
      .populate('studentId',    'name email walletAddress')
      .populate('activityType', 'name points');

    // FIX 1: return the full object including _id
    res.json(populated);

  } catch (error) {
    console.error('Activity add error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /activity/student/:id ────────────────────────────────────────────────
router.get('/student/:id', async (req, res) => {
  try {
    const activities = await Activity.find({ studentId: req.params.id })
      .populate('studentId',    'name email walletAddress')
      .populate('activityType', 'name points')
      .sort({ createdAt: -1 });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /activity/verify/:id ────────────────────────────────────────────────
/**
 * Single source of truth for approval/rejection.
 * The frontend store does NOT separately call /students/:id/points or mint
 * on-chain — this endpoint handles everything atomically.
 *
 * Returns: { message, status, activityId, blockchainMinted }
 */
router.post('/verify/:id', async (req, res) => {
  try {
    const { status, reason } = req.body;

    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    // Idempotency — don't double-approve
    if (activity.verificationStatus === 'approved' && status === 'approved') {
      return res.json({
        message:           'Already approved',
        status:            'approved',
        activityId:        activity._id,
        blockchainMinted:  false,
      });
    }

    activity.verificationStatus = status;
    if (status === 'rejected' && reason) {
      activity.rejectionReason = reason;
    }
    await activity.save();

    let blockchainMinted = false;

    // ── Approval side-effects ─────────────────────────────────────────────
    if (status === 'approved') {
      const student = await Student.findById(activity.studentId);

      if (!student) {
        console.warn('⚠️ Student not found for activity:', activity.studentId);
        return res.json({
          message:          'Verification updated (student not found)',
          status,
          activityId:       activity._id,
          blockchainMinted: false,
        });
      }

      // Atomically increment both ecoPoints and cctTokens — single $inc, never double
      const updatedStudent = await Student.findByIdAndUpdate(
        activity.studentId,
        { $inc: { ecoPoints: activity.pointsEarned, cctTokens: activity.pointsEarned } },
        { new: true }
      );
      console.log(`✅ +${activity.pointsEarned} pts → ${student.name} | total: ${updatedStudent?.ecoPoints} pts`);

      // mintTokens() catches its own errors and returns true/false — use the return value
      const walletAddr = (student.walletAddress || '').trim();
      if (/^0x[0-9a-fA-F]{40}$/.test(walletAddr)) {
        blockchainMinted = await mintTokens(walletAddr, activity.pointsEarned);
        if (blockchainMinted) {
          console.log(`✅ Minted ${activity.pointsEarned} CCT → ${walletAddr}`);
        } else {
          console.warn(`⚠️ Mint skipped/failed. Is npx hardhat node running? Points saved in DB.`);
        }
      } else {
        console.log(`⚠️ No valid wallet for ${student.name} — student must connect MetaMask on Wallet page first.`);
      }
    }

    res.json({
      message:          'Verification updated',
      status,
      activityId:       activity._id,
      blockchainMinted,              // ← frontend reads this to show correct alert
    });

  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;