require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  esp32ApiKey: required('ESP32_API_KEY'),
  mlServiceUrl: (process.env.ML_SERVICE_URL || 'http://ml-service:8000').replace(/\/$/, ''),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:8080').split(',').map(s => s.trim()),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@parqco.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'change-me-immediately',
  demoMode: String(process.env.DEMO_MODE || 'false').toLowerCase() === 'true',
};
