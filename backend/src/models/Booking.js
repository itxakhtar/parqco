const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    slotId: { type: String, required: true, trim: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active' },
  },
  { timestamps: true }
);

bookingSchema.index({ slotId: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
