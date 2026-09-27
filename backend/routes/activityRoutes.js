/**
 * EcoLedger: activities
 *
 * Flow: a student submits proof → an admin approves → the server credits points
 * and mints CCT to the student's wallet in the same request, and records the
 * transaction hash (or the exact reason minting failed, which can be retried).
 */
const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Activity = require('../models/Activity');
const ActivityType = require('../models/ActivityType');
const Student = require('../models/Student');
const Proof = require('../models/Proof');
const upload = require('../middleware/upload');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { mintReward, checkMint, newWalletAddress, isAddress } = require('../config/blockchain');

const router = express.Router();
const POPULATE = [
  { path: 'studentId', select: 'name email walletAddress' },
  { path: 'activityType', select: 'name points icon' },
];

// POST /api/activity: submit an activity (student)
router.post('/', requireAuth, (req, res, next) => {
  upload.single('proofImage')(req, res, (err) => (err ? res.status(400).json({ error: err.message }) : next()));
}, async (req, res) => {
  try {
    const { activityType, description, location } = req.body;
    const type = mongoose.Types.ObjectId.isValid(activityType)
      ? await ActivityType.findById(activityType)
      : await ActivityType.findOne({ name: activityType });
    if (!type) return res.status(400).json({ error: 'Please choose an activity type.' });
    if (!description || description.trim().length < 5) return res.status(400).json({ error: 'Please describe what you did.' });

    let proofImage = null;
    if (req.file) {
      const key = crypto.randomBytes(16).toString('hex');
      await Proof.create({ key, data: req.file.buffer, contentType: req.file.mimetype, owner: req.user._id });
      proofImage = `/api/proofs/${key}`;
    }

    const activity = await Activity.create({
      studentId: req.user._id,
      activityType: type._id,
      description,
      location,
      pointsEarned: type.points,
      proofImage,
    });
    res.status(201).json(await activity.populate(POPULATE));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/activity/mine: the signed-in student's activities
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const mine = await Activity.find({ studentId: req.user._id }).populate(POPULATE).sort({ createdAt: -1 });
    await settlePending(mine);
    res.json(mine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/activity?status=pending: all activities (admin)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const filter = ['pending', 'approved', 'rejected'].includes(req.query.status) ? { verificationStatus: req.query.status } : {};
    const all = await Activity.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    await settlePending(all);
    res.json(all.filter((a) => a.studentId && a.activityType)); // skip orphaned test records
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function markMinted(activity, txHash, blockNumber) {
  // Only the request that flips the record to "minted" credits the tokens, so they are never counted twice.
  const claimed = await Activity.findOneAndUpdate(
    { _id: activity._id, mintStatus: { $ne: 'minted' } },
    { mintStatus: 'minted', mintTxHash: txHash, mintBlock: blockNumber, mintError: null },
    { new: true },
  );
  if (claimed) await Student.updateOne({ _id: activity.studentId }, { $inc: { cctTokens: activity.pointsEarned } });
  Object.assign(activity, { mintStatus: 'minted', mintTxHash: txHash, mintBlock: blockNumber, mintError: null });
}

async function mintFor(activity) {
  const student = await Student.findById(activity.studentId);
  if (!student) return { ok: false, reason: 'Student not found.' };
  if (!isAddress(student.walletAddress)) {
    student.walletAddress = newWalletAddress();
    await student.save();
  }
  const result = await mintReward(student.walletAddress, activity.pointsEarned, activity._id);
  if (result.ok) {
    await markMinted(activity, result.txHash, result.blockNumber);
    return result;
  }
  activity.mintStatus = result.pending ? 'pending' : 'failed';
  activity.mintTxHash = result.txHash || null;
  activity.mintError = result.pending ? null : result.reason;
  await activity.save();
  return result;
}

/** Settle mints that were sent but not confirmed when the request ended. */
async function settlePending(activities) {
  const pending = activities.filter((a) => a.mintStatus === 'pending' && a.mintTxHash).slice(0, 10);
  await Promise.all(pending.map(async (a) => {
    const r = await checkMint(a.mintTxHash);
    if (r.state === 'minted') await markMinted(a, a.mintTxHash, r.blockNumber);
    else if (r.state === 'failed') {
      a.mintStatus = 'failed';
      a.mintError = 'The mint transaction did not go through on-chain. Retry to send it again.';
      await a.save();
    }
  }));
}

// POST /api/activity/:id/verify  { status: 'approved' | 'rejected', reason? } (admin)
router.post('/:id/verify', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected.' });

    // Claim the pending record atomically so a double click can never credit twice.
    const activity = await Activity.findOneAndUpdate(
      { _id: req.params.id, verificationStatus: 'pending' },
      {
        verificationStatus: status,
        rejectionReason: status === 'rejected' ? (reason || 'Not enough proof.') : null,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
      },
      { new: true },
    );
    if (!activity) return res.status(409).json({ error: 'This activity was already reviewed or no longer exists.' });

    let mint = null;
    if (status === 'approved') {
      await Student.updateOne({ _id: activity.studentId }, { $inc: { ecoPoints: activity.pointsEarned } });
      mint = await mintFor(activity);
    }
    res.json({ activity: await activity.populate(POPULATE), mint });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/activity/:id/retry-mint (admin): mint again after the chain was offline
router.post('/:id/retry-mint', requireAuth, requireAdmin, async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity || activity.verificationStatus !== 'approved') return res.status(400).json({ error: 'Only approved activities can be minted.' });
    if (activity.mintStatus === 'minted') return res.status(409).json({ error: 'Tokens were already minted for this activity.' });
    // A transaction that was sent earlier may have confirmed since; never send a second one while it can still land.
    if (activity.mintTxHash) {
      const r = await checkMint(activity.mintTxHash);
      if (r.state === 'minted') {
        await markMinted(activity, activity.mintTxHash, r.blockNumber);
        return res.json({ activity: await activity.populate(POPULATE), mint: { ok: true, txHash: activity.mintTxHash, blockNumber: r.blockNumber } });
      }
      if (r.state === 'pending' || r.state === 'unknown') {
        return res.json({ activity: await activity.populate(POPULATE), mint: { ok: false, pending: true, txHash: activity.mintTxHash, reason: 'Still waiting for the earlier transaction to confirm.' } });
      }
    }
    const mint = await mintFor(activity);
    res.json({ activity: await activity.populate(POPULATE), mint });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
