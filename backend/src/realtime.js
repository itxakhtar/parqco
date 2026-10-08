const { Server } = require('socket.io');
const config = require('./config');
const Slot = require('./models/Slot');

let io = null;

function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: config.corsOrigin } });
  io.on('connection', async (socket) => {
    // Send current state immediately so new clients render instantly.
    const slots = await Slot.find().sort({ slotId: 1 }).lean();
    socket.emit('slots:update', slots);
    socket.emit('stats:update', statsFor(slots));
  });
  return io;
}

function statsFor(slots) {
  const total = slots.length;
  const occupied = slots.filter((s) => s.status === 'occupied').length;
  return {
    total,
    occupied,
    available: total - occupied,
    occupancyPct: total ? Math.round((occupied / total) * 100) : 0,
  };
}

async function broadcastSlots() {
  if (!io) return;
  const slots = await Slot.find().sort({ slotId: 1 }).lean();
  io.emit('slots:update', slots);
  io.emit('stats:update', statsFor(slots));
}

module.exports = { initRealtime, broadcastSlots, statsFor };
