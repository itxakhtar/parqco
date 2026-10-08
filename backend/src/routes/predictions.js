const express = require('express');
const axios = require('axios');
const config = require('../config');

const router = express.Router();
const ml = axios.create({ baseURL: config.mlServiceUrl, timeout: 20000 });

function mlError(err, res) {
  if (err.response?.status === 503) {
    return res.status(503).json({
      error: 'No prediction data yet',
      hint: 'As an admin, open Admin → "Generate sample history" (or POST /api/admin/seed), then train the model.',
    });
  }
  console.error('ML service error:', err.message);
  return res.status(502).json({ error: 'Prediction service unavailable' });
}

// 24h (or ?hours=N) occupancy forecast.
router.get('/', async (req, res) => {
  try {
    const hours = Math.min(Math.max(parseInt(req.query.hours || '24', 10), 1), 72);
    const { data } = await ml.get('/predict', { params: { hours } });
    res.json(data);
  } catch (err) { mlError(err, res); }
});

// Predicted peak window, e.g. { peakStart, peakEnd, occupancyPct }.
router.get('/peak', async (req, res) => {
  try {
    const { data } = await ml.get('/peak');
    res.json(data);
  } catch (err) { mlError(err, res); }
});

module.exports = router;
