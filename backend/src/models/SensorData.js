const mongoose = require('mongoose');

// Append-only log of every sensor reading. This is the history the ML
// model trains on, so we keep it even though Slots holds the live state.
const sensorDataSchema = new mongoose.Schema(
  {
    slotId: { type: String, required: true, index: true },
    sensorId: { type: String, default: null },
    occupied: { type: Boolean, required: true },
    distanceCm: { type: Number, default: null },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

sensorDataSchema.index({ at: 1, slotId: 1 });

module.exports = mongoose.model('SensorData', sensorDataSchema);
