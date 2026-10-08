/*
 * PARQCO — ESP32 parking sensor firmware
 *
 * Each HC-SR04 ultrasonic sensor watches one parking slot.
 * When a slot's state changes (free <-> occupied) the ESP32 POSTs:
 *   { "sensorId": "...", "slotId": "A1", "occupied": true, "distanceCm": 42 }
 * to  BACKEND_URL + "/api/sensor-data"  with header  x-api-key: API_KEY
 *
 * Setup:
 *   1. cp config.example.h config.h  and fill in the 4 secret values
 *   2. Arduino IDE: install "esp32" board + "ArduinoJson" library
 *   3. Select your ESP32 board, flash.
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

bool reportedState[NUM_SLOTS];      // last state sent to backend
bool candidateState[NUM_SLOTS];     // current debounce candidate
uint8_t stableCount[NUM_SLOTS];      // consecutive matching reads
unsigned long lastHeartbeat = 0;

long readDistanceCm(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 30000);  // 30ms timeout
  if (duration == 0) return -1;                  // no echo = sensor fault
  return duration / 58;                          // cm
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? "\nWiFi connected" : "\nWiFi FAILED - will retry");
}

bool postReading(const char* slotId, bool occupied, long distanceCm) {
  if (WiFi.status() != WL_CONNECTED) { connectWiFi(); }
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/sensor-data";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  http.setTimeout(8000);

  StaticJsonDocument<256> doc;
  doc["sensorId"] = SENSOR_ID;
  doc["slotId"] = slotId;
  doc["occupied"] = occupied;
  doc["distanceCm"] = (int)distanceCm;
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("[%s] occupied=%d dist=%ldcm -> HTTP %d\n", slotId, occupied, distanceCm, code);
  http.end();
  return code >= 200 && code < 300;
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < NUM_SLOTS; i++) {
    pinMode(TRIG_PINS[i], OUTPUT);
    pinMode(ECHO_PINS[i], INPUT);
    reportedState[i] = false;
    candidateState[i] = false;
    stableCount[i] = 0;
  }
  connectWiFi();
}

void loop() {
  connectWiFi();
  unsigned long now = millis();
  bool heartbeatDue = (now - lastHeartbeat) > HEARTBEAT_MS;

  for (int i = 0; i < NUM_SLOTS; i++) {
    long d = readDistanceCm(TRIG_PINS[i], ECHO_PINS[i]);
    if (d < 0) continue;  // skip faulty reading

    bool occupied = d < OCCUPIED_THRESHOLD_CM;

    // Debounce: require 3 consecutive identical readings
    if (occupied == candidateState[i]) {
      if (stableCount[i] < 255) stableCount[i]++;
    } else {
      candidateState[i] = occupied;
      stableCount[i] = 1;
    }

    bool changed = (stableCount[i] >= 3 && candidateState[i] != reportedState[i]);
    if (changed || heartbeatDue) {
      if (postReading(SLOT_IDS[i], candidateState[i], d)) {
        reportedState[i] = candidateState[i];
      }
    }
  }

  if (heartbeatDue) lastHeartbeat = now;
  delay(READ_INTERVAL_MS);
}
