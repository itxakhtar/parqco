// ============================================================
// PARQCO ESP32 firmware — copy to config.h and fill in values.
//   cp config.example.h config.h   (config.h is git-ignored)
// ============================================================
#pragma once

// WiFi the ESP32 joins (2.4 GHz)
#define WIFI_SSID       "PASTE_WIFI_NAME_HERE"
#define WIFI_PASSWORD   "PASTE_WIFI_PASSWORD_HERE"

// Public URL of your backend — NO trailing slash, https in production
// e.g. "https://parqco-api.onrender.com"  (local test: "http://192.168.1.50:5000")
#define BACKEND_URL     "PASTE_BACKEND_URL_HERE"

// MUST be identical to ESP32_API_KEY in backend/.env
#define API_KEY         "PASTE_SAME_API_KEY_AS_BACKEND_ENV"

// Unique ID for this device (use esp32-02, esp32-03… for more units)
#define SENSOR_ID       "esp32-01"

// ---- Slots: one HC-SR04 per slot. Add entries to support more slots. ----
#define NUM_SLOTS 2
const int TRIG_PINS[NUM_SLOTS] = { 5, 18 };   // GPIO per slot
const int ECHO_PINS[NUM_SLOTS] = { 19, 21 };  // GPIO per slot
const char* SLOT_IDS[NUM_SLOTS] = { "A1", "A2" };

// Distance below which the slot counts as occupied (cm)
#define OCCUPIED_THRESHOLD_CM 60

// How often to sample each sensor (ms)
#define READ_INTERVAL_MS 2000
// Re-send current state even if unchanged (heartbeat, ms)
#define HEARTBEAT_MS 60000
