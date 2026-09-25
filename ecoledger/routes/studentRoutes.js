/**
 * EcoLedger: accounts, profile, wallet, leaderboard
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const Activity = require('../models/Activity');
const { signToken, requireAuth } = require('../middleware/auth');
const { getBalance, newWalletAddress, isAddress, status } = require('../config/blockchain');

const router = express.Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/students/register
router.post('/register', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
    if (!EMAIL.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (await Student.findOne({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });

    const walletAddress = isAddress(req.body.walletAddress || '') ? req.body.walletAddress.trim() : newWalletAddress();
    const student = await Student.create({ name, email, password: await bcrypt.hash(password, 10), walletAddress });
    res.status(201).json({ token: signToken(student), user: student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/students/login
router.post('/login', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const student = await Student.findOne({ email });
    if (!student) return res.status(404).json({ error: 'No account found with this email.' });

    const hashed = /^\$2[aby]\$/.test(student.password);
    const ok = hashed ? await bcrypt.compare(password, student.password) : student.password === password;
    if (!ok) return res.status(401).json({ error: 'Incorrect password.' });
    if (!hashed) student.password = await bcrypt.hash(password, 10); // upgrade old plain-text records
    if (!isAddress(student.walletAddress)) student.walletAddress = newWalletAddress();
    await student.save();

    res.json({ token: signToken(student), user: student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/students/me
router.get('/me', requireAuth, (req, res) => res.json(req.user));

// GET /api/students/leaderboard
router.get('/leaderboard', async (_req, res) => {
  try {
    const top = await Student.find({ role: 'student' })
      .sort({ cctTokens: -1, ecoPoints: -1, createdAt: 1 })
      .limit(20)
      .select('name ecoPoints cctTokens');
    res.json(top);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/students/wallet: on-chain balance plus the mint history behind it
router.get('/wallet', requireAuth, async (req, res) => {
  try {
    const [onChain, chain, mints] = await Promise.all([
      getBalance(req.user.walletAddress),
      status(),
      Activity.find({ studentId: req.user._id, mintStatus: 'minted' })
        .populate('activityType', 'name')
        .sort({ verifiedAt: -1 })
        .limit(20)
        .select('activityType pointsEarned mintTxHash mintBlock verifiedAt'),
    ]);
    res.json({
      walletAddress: req.user.walletAddress,
      onChainBalance: onChain,          // null when the chain is offline
      recordedTokens: req.user.cctTokens,
      ecoPoints: req.user.ecoPoints,
      chain,
      mints,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/students/wallet: connect your own wallet address instead of the generated one
router.post('/wallet', requireAuth, async (req, res) => {
  const addr = (req.body.walletAddress || '').trim();
  if (!isAddress(addr)) return res.status(400).json({ error: 'Wallet address must start with 0x and be 42 characters long.' });
  req.user.walletAddress = addr;
  await req.user.save();
  res.json(req.user);
});

module.exports = router;
