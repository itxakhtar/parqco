const express = require('express');
const Slot = require('../models/Slot');
const { auth, adminOnly } = require('../middleware/auth');
const { broadcastSlots, statsFor } = require('../realtime');

const router = express.Router();

// Public: live slot list for the dashboard grid.
router.get('/', async (req, res) => {
  const slots = await Slot.find().sort({ slotId: 1 }).lean();
  res.json({ slots });
});

router.get('/stats', async (req, res) => {
  const slots = await Slot.find().lean();
  res.json(statsFor(slots));
});

// Admin: add a slot (e.g. when wiring a new sensor).
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { slotId, label, zone } = req.body;
    if (!slotId) return res.status(400).json({ error: 'slotId is required' });
    const slot = await Slot.create({
      slotId: slotId.trim().toUpperCase(),
      label: (label || slotId).trim(),
      zone: (zone || slotId.trim()[0] || 'A').toUpperCase(),
    });
    await broadcastSlots();
    res.status(201).json({ slot });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Slot already exists' });
    res.status(500).json({ error: 'Could not create slot' });
  }
});

// Admin: manual override (useful when a sensor is offline).
router.patch('/:slotId', auth, adminOnly, async (req, res) => {
  const { status } = req.body;
  if (!['available', 'occupied'].includes(status)) {
    return res.status(400).json({ error: 'status must be available|occupied' });
  }
  const slot = await Slot.findOneAndUpdate(
    { slotId: req.params.slotId.toUpperCase() },
    { status, lastSeenAt: new Date() },
    { new: true }
  );
  if (!slot) return res.status(404).json({ error: 'Slot not found' });
  await broadcastSlots();
  res.json({ slot });
});

// Admin: remove a slot.
router.delete('/:slotId', auth, adminOnly, async (req, res) => {
  const slot = await Slot.findOneAndDelete({ slotId: req.params.slotId.toUpperCase() });
  if (!slot) return res.status(404).json({ error: 'Slot not found' });
  await broadcastSlots();
  res.json({ ok: true });
});

module.exports = router;
