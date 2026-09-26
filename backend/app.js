/**
 * EcoLedger API: the Express app, shared by
 *   server.js      a normal long-running server (local, Render, Railway...)
 *   api/index.js   a Vercel serverless function
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

// Connect and seed once per process (or per serverless instance), on first use.
let readyPromise = null;
function ready() {
  if (isProd && !process.env.JWT_SECRET) return Promise.reject(new Error('JWT_SECRET must be set in production.'));
  if (!readyPromise) {
    readyPromise = connectDB().then(seed).catch((err) => {
      readyPromise = null; // try again on the next request
      throw err;
    });
  }
  return readyPromise;
}

const app = express();
// CORS_ORIGIN: comma-separated list of allowed sites (e.g. your Vercel URL). Empty = allow all.
const origins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));
app.use(express.json());
// Photos from older versions that were saved to disk
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (_req, res) => res.send('EcoLedger API is running. See /api/health.'));

// GET /api/health: what the app shows in its status bar
app.get('/api/health', async (_req, res) => {
  let dbError;
  await ready().catch((err) => { dbError = err.message; });
  res.json({
    server: true,
    database: mongoose.connection.readyState === 1,
    ...(dbError ? { databaseError: isProd ? 'Database connection failed. Check MONGO_URI.' : dbError } : {}),
    chain: await blockchain.status(),
  });
});

// Every other API route needs the database
app.use('/api', (_req, res, next) => {
  ready().then(() => next(), (err) => res.status(503).json({ error: `Server not ready: ${err.message}` }));
});

app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/activity-types', require('./routes/activityTypeRoutes'));
app.use('/api/rewards', require('./routes/rewardRoutes'));
app.use('/api/proofs', require('./routes/proofRoutes'));

app.ready = ready;
module.exports = app;
