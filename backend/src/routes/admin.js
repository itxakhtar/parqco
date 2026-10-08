const express = require('express');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');
const { setDemoMode, isDemoMode } = require('../demoSimulator');

const router = express.Router();
router.use(auth, adminOnly);
const ml = axios.create({ baseURL: config.mlServiceUrl, timeout: 60000 });

// Generate 28 days of realistic sample history, then train the model.
router.post('/seed', async (req, res) => {
  try {
    const { data } = await ml.post('/seed');
    res.json({ ok: true, ml: data });
  } catch (err) {
    console.error('seed error:', err.message);
    res.status(502).json({ error: 'ML service unavailable for seeding' });
  }
});

// Retrain the prediction model on current history.
router.post('/train', async (req, res) => {
  try {
    const { data } = await ml.post('/train');
    res.json({ ok: true, ml: data });
  } catch (err) {
    console.error('train error:', err.message);
    res.status(502).json({ error: 'ML service unavailable for training' });
  }
});

// Toggle the sensor simulator (demo-day safety net).
router.post('/demo-mode', (req, res) => {
  setDemoMode(!!req.body.enabled);
  res.json({ demoMode: isDemoMode() });
});

router.get('/demo-mode', (req, res) => {
  res.json({ demoMode: isDemoMode() });
});

// Ensure the first admin exists (also runs automatically on boot).
router.post('/ensure-admin', async (req, res) => {
  const user = await ensureAdmin();
  res.json({ admin: user.email });
});

async function ensureAdmin() {
  let user = await User.findOne({ email: config.adminEmail.toLowerCase() });
  if (!user) {
    const passwordHash = await bcrypt.hash(config.adminPassword, 10);
    user = await User.create({
      name: 'Administrator',
      email: config.adminEmail.toLowerCase(),
      passwordHash,
      role: 'admin',
    });
    console.log(`Admin account created: ${user.email}`);
  }
  return user;
}

module.exports = { router, ensureAdmin };
