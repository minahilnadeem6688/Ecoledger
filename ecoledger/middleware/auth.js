/**
 * EcoLedger: token auth. Students and admins sign in and send
 * "Authorization: Bearer <token>" with every request.
 */
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

const SECRET = process.env.JWT_SECRET || 'ecoledger-dev-secret-change-me';

function signToken(student) {
  return jwt.sign({ id: String(student._id), role: student.role }, SECRET, { expiresIn: '7d' });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please sign in first.' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = await Student.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'Account no longer exists. Please sign in again.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  next();
}

module.exports = { signToken, requireAuth, requireAdmin };
