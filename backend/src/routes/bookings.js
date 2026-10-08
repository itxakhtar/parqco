const express = require('express');
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// My bookings (admin sees everything).
router.get('/', async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { user: req.user.id };
  const bookings = await Booking.find(filter).sort({ startTime: 1 }).lean();
  res.json({ bookings });
});

// Reserve a slot for a time window. Rejects overlapping active bookings.
router.post('/', async (req, res) => {
  try {
    const { slotId, startTime, endTime } = req.body;
    if (!slotId || !startTime || !endTime) {
      return res.status(400).json({ error: 'slotId, startTime and endTime are required' });
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start) || isNaN(end) || end <= start) {
      return res.status(400).json({ error: 'Invalid time window' });
    }
    if (start < new Date(Date.now() - 60000)) {
      return res.status(400).json({ error: 'Start time must be in the future' });
    }
    const id = String(slotId).trim().toUpperCase();
    const slot = await Slot.findOne({ slotId: id });
    if (!slot) return res.status(404).json({ error: 'Slot not found' });

    const clash = await Booking.findOne({
      slotId: id,
      status: 'active',
      startTime: { $lt: end },
      endTime: { $gt: start },
    });
    if (clash) return res.status(409).json({ error: 'Slot already booked for that time' });

    const booking = await Booking.create({ user: req.user.id, slotId: id, startTime: start, endTime: end });
    res.status(201).json({ booking });
  } catch (err) {
    res.status(500).json({ error: 'Booking failed' });
  }
});

// Cancel (owner or admin).
router.delete('/:id', async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (req.user.role !== 'admin' && String(booking.user) !== req.user.id) {
    return res.status(403).json({ error: 'Not your booking' });
  }
  booking.status = 'cancelled';
  await booking.save();
  res.json({ ok: true });
});

// Admin: mark past bookings completed (call on a schedule or manually).
router.post('/sweep', auth, adminOnly, async (req, res) => {
  const r = await Booking.updateMany(
    { status: 'active', endTime: { $lt: new Date() } },
    { $set: { status: 'completed' } }
  );
  res.json({ completed: r.modifiedCount });
});

module.exports = router;
