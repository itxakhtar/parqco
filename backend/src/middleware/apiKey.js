const config = require('../config');

// Protects the ESP32 ingest endpoint: the firmware must send the shared
// secret as the `x-api-key` header. Prevents spoofed slot data.
function apiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== config.esp32ApiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

module.exports = { apiKey };
