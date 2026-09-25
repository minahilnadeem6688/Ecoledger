const express = require('express');
const router  = express.Router();
const Student = require('../models/Student');
const { getBalance } = require('../config/blockchain');

/* Create Student */
router.post('/create', async (req, res) => {
  try {
    const { name, email, password, walletAddress } = req.body;
    const existing = await Student.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const student = new Student({ name, email, password, walletAddress: walletAddress || '', ecoPoints: 0, cctTokens: 0 });
    await student.save();
    res.json({ message: 'Student created', student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* Login Student */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const student = await Student.findOne({ email });
    if (!student) return res.status(404).json({ error: 'No account found with this email' });
    if (student.password !== password) return res.status(401).json({ error: 'Incorrect password' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* Get All Students */
router.get('/', async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* Leaderboard */
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await Student
      .find()
      .sort({ ecoPoints: -1 })
      .limit(20)
      .select('name email ecoPoints cctTokens walletAddress');
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* Get single student */
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* Update student points — called after admin approval or reward redemption */
router.post('/:id/points', async (req, res) => {
  try {
    const { ecoPoints, cctTokens } = req.body;
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { ecoPoints, cctTokens },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Points updated', student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* Update wallet address */
router.post('/:id/wallet', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { walletAddress },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Wallet updated', student });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* Get blockchain balance from Hardhat */
router.get('/balance/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    // Try real Hardhat balance first
    let tokens = 0;
    try {
      tokens = await getBalance(student.walletAddress);
    } catch {
      // Hardhat not running — use DB value
      tokens = student.cctTokens ?? student.ecoPoints ?? 0;
    }
    res.json({ wallet: student.walletAddress, tokens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;