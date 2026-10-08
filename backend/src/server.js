const http = require('http');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { connectDb } = require('./db');
const { initRealtime } = require('./realtime');
const { setDemoMode } = require('./demoSimulator');
const { router: adminRouter, ensureAdmin } = require('./routes/admin');

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));

// Basic abuse protection on the public API.
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 300 }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'parqco-backend' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/slots', require('./routes/slots'));
app.use('/api', require('./routes/sensor'));          // POST /api/sensor-data
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/admin', adminRouter);

// 404 + error handler
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  await connectDb();
  await ensureAdmin();
  const server = http.createServer(app);
  initRealtime(server);
  if (config.demoMode) setDemoMode(true);
  server.listen(config.port, () => console.log(`PARQCO backend on :${config.port}`));
}

main().catch((err) => {
  console.error('Fatal startup error:', err.message);
  process.exit(1);
});
