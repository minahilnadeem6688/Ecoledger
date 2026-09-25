/**
 * GET /api/proofs/:key: serves a proof photo. Keys are random 32-character
 * strings, so photos can be shown in <img> tags without exposing a guessable id.
 */
const express = require('express');
const Proof = require('../models/Proof');

const router = express.Router();

router.get('/:key', async (req, res) => {
  try {
    if (!/^[a-f0-9]{32}$/.test(req.params.key)) return res.status(404).end();
    const proof = await Proof.findOne({ key: req.params.key });
    if (!proof) return res.status(404).end();
    res.set('Content-Type', proof.contentType);
    res.set('Cache-Control', 'private, max-age=86400');
    res.send(proof.data);
  } catch {
    res.status(500).end();
  }
});

module.exports = router;
