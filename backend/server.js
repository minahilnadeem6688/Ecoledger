/**
 * EcoLedger API
 *   npm run chain    →  local blockchain (terminal 1)
 *   npm run deploy   →  deploy the CCT token (terminal 2, once per chain start)
 *   npm start        →  this server on http://localhost:5000 (terminal 3)
 * Production settings are listed in .env.example and docs/DEPLOYMENT.md.
 */
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const seed = require('./config/seed');
const blockchain = require('./config/blockchain');

const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.JWT_SECRET) {
  console.error('JWT_SECRET must be set in production. Refusing to start.');
  process.exit(1);
}

const app = express();
// CORS_ORIGIN: comma-separated list of allowed sites (e.g. your Vercel URL). Empty = allow all.
const origins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));
app.use(express.json());
// Photos from older versions that were saved to disk
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/activity-types', require('./routes/activityTypeRoutes'));
app.use('/api/rewards', require('./routes/rewardRoutes'));
app.use('/api/proofs', require('./routes/proofRoutes'));

// GET /api/health: what the app shows in its status bar
app.get('/api/health', async (_req, res) => {
  res.json({
    server: true,
    database: mongoose.connection.readyState === 1,
    chain: await blockchain.status(),
  });
});

app.get('/', (_req, res) => res.send('EcoLedger API is running. See /api/health.'));

const PORT = Number(process.env.PORT) || 5000;

connectDB()
  .then(seed)
  .catch((err) => console.error('MongoDB connection failed:', err.message))
  .finally(async () => {
    app.listen(PORT, '0.0.0.0', () => console.log(`EcoLedger API on http://localhost:${PORT}`));
    const chain = await blockchain.status();
    console.log(chain.contract ? `Blockchain ready: CCT at ${chain.address}` : `Blockchain not ready: ${chain.reason}`);
  });

module.exports = app;
