const express = require('express');
const Slot = require('../models/Slot');
const SensorData = require('../models/SensorData');
const { apiKey } = require('../middleware/apiKey');
const { broadcastSlots } = require('../realtime');

const router = express.Router();

/**
 * ESP32 ingest endpoint. Firmware POSTs:
 *   { "sensorId": "esp32-01", "slotId": "A1", "occupied": true, "distanceCm": 42 }
 * Protected by the shared ESP32_API_KEY (x-api-key header).
 * Unknown slots are auto-provisioned so new sensors "just work".
 */
router.post('/sensor-data', apiKey, async (req, res) => {
  try {
    const { sensorId, slotId, occupied, distanceCm } = req.body;
    if (!slotId || typeof occupied !== 'boolean') {
      return res.status(400).json({ error: 'slotId and occupied(boolean) are required' });
    }
    const id = String(slotId).trim().toUpperCase();

    let slot = await Slot.findOne({ slotId: id });
    if (!slot) {
      slot = await Slot.create({ slotId: id, label: id, zone: id[0] || 'A' });
    }
    slot.status = occupied ? 'occupied' : 'available';
    slot.sensorId = sensorId || slot.sensorId;
    slot.lastDistanceCm = typeof distanceCm === 'number' ? distanceCm : slot.lastDistanceCm;
    slot.lastSeenAt = new Date();
    await slot.save();

    await SensorData.create({
      slotId: id,
      sensorId: sensorId || null,
      occupied,
      distanceCm: typeof distanceCm === 'number' ? distanceCm : null,
      at: new Date(),
    });

    await broadcastSlots();
    res.json({ ok: true, slotId: id, status: slot.status });
  } catch (err) {
    console.error('sensor-data error:', err.message);
    res.status(500).json({ error: 'Failed to record reading' });
  }
});

module.exports = router;
