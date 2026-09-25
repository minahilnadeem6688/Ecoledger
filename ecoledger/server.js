/**
 * EcoLedger API
 *   npm run chain    →  local blockchain (terminal 1)
 *   npm run deploy   →  deploy the CCT token (terminal 2, once per chain start)
 *   npm start        →  this server on http://localhost:5000 (terminal 3)
 */
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const seed = require('./config/seed');
const blockchain = require('./config/blockchain');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/activity-types', require('./routes/activityTypeRoutes'));
app.use('/api/rewards', require('./routes/rewardRoutes'));

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
