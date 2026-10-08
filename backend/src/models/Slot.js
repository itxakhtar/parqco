const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema(
  {
    slotId: { type: String, required: true, unique: true, trim: true }, // e.g. "A1"
    label: { type: String, required: true, trim: true },               // display name
    zone: { type: String, default: 'A', trim: true },
    status: { type: String, enum: ['available', 'occupied'], default: 'available' },
    sensorId: { type: String, default: null },  // ESP32/sensor that last reported
    lastDistanceCm: { type: Number, default: null },
    lastSeenAt: { type: Date, default: null },  // last sensor heartbeat
  },
  { timestamps: true }
);

module.exports = mongoose.model('Slot', slotSchema);
