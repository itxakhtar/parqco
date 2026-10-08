const Slot = require('./models/Slot');
const SensorData = require('./models/SensorData');
const { broadcastSlots } = require('./realtime');

// Demo-day safety net: simulates ESP32 sensor traffic so the dashboard,
// bookings and predictions work live even without hardware on stage WiFi.
let timer = null;
let enabled = false;

async function tick() {
  try {
    let slots = await Slot.find();
    if (slots.length === 0) {
      // Auto-provision a small demo lot on first run.
      const seed = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
      for (const slotId of seed) {
        await Slot.create({ slotId, label: slotId, zone: slotId[0] });
      }
      slots = await Slot.find();
    }
    // Flip 1-3 random slots each tick.
    const flips = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < flips; i++) {
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const occupied = slot.status !== 'occupied';
      slot.status = occupied ? 'occupied' : 'available';
      slot.sensorId = 'demo-simulator';
      slot.lastDistanceCm = occupied ? 20 + Math.random() * 30 : 150 + Math.random() * 100;
      slot.lastSeenAt = new Date();
      await slot.save();
      await SensorData.create({
        slotId: slot.slotId, sensorId: 'demo-simulator',
        occupied, distanceCm: Math.round(slot.lastDistanceCm), at: new Date(),
      });
    }
    await broadcastSlots();
  } catch (err) {
    console.error('demo simulator tick failed:', err.message);
  }
}

function setDemoMode(on) {
  enabled = on;
  if (timer) { clearInterval(timer); timer = null; }
  if (on) {
    console.log('Demo mode ENABLED — simulating sensor traffic');
    tick();
    timer = setInterval(tick, 8000);
  } else {
    console.log('Demo mode disabled');
  }
}

function isDemoMode() { return enabled; }

module.exports = { setDemoMode, isDemoMode };
