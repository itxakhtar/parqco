# PARQCO — ESP32 + HC-SR04 Wiring Guide

Read this **before** connecting real hardware. One mistake here can
permanently damage the ESP32.

## ⚠️ The voltage warning (most important thing on this page)

- The HC-SR04 runs on **5 V**. Its **Echo pin outputs 5 V**.
- ESP32 GPIO pins are **3.3 V only — they are NOT 5 V tolerant.**
  Feeding 5 V into an ESP32 pin can burn out that pin or the whole board.
- **Fix — voltage divider on every Echo line** (Trig needs nothing:
  the ESP32's 3.3 V output is enough to trigger the sensor):

```
HC-SR04 Echo ───[ 1 kΩ ]───┬──── ESP32 Echo GPIO
                           │
                         [ 2 kΩ ]
                           │
                          GND
```

This divides 5 V down to 5 × 2/(1+2) = **3.33 V** — safe for the ESP32.
(1 kΩ + 2 kΩ are the common values; any pair with the same 1:2 ratio works.)

## Wiring per sensor (one HC-SR04 per slot)

| HC-SR04 pin | Connect to |
|---|---|
| VCC | ESP32 **5 V / VIN** pin (from USB) — not 3.3 V, the sensor needs 5 V |
| GND | ESP32 GND (common ground — the divider's 2 kΩ also goes here) |
| Trig | ESP32 GPIO from `TRIG_PINS` in `firmware/config.h` |
| Echo | → voltage divider above → ESP32 GPIO from `ECHO_PINS` in `firmware/config.h` |

Default pins in `firmware/config.example.h` (2 slots shown; extend the
arrays in your `config.h` for more slots):

| Slot | Trig GPIO | Echo GPIO |
|---|---|---|
| A1 | 5 | 19 |
| A2 | 18 | 21 |

## Power notes

- Power the ESP32 over USB (5 V). Two HC-SR04s draw ~15 mA each — fine
  from USB. For 4+ sensors, use a decent 5 V / 2 A supply and keep a
  **common ground** between supply, ESP32, and all sensors.
- Mount each sensor facing straight down at the slot (or straight at
  the parking position),  unobstructed. The firmware counts a slot as
  **occupied when distance < 60 cm** (`OCCUPIED_THRESHOLD_CM` in
  `config.h`) — adjust after measuring your mounting height.

## Firmware setup (Arduino IDE)

1. Copy `firmware/config.example.h` → `firmware/config.h` and fill in
   the 4 values: WiFi name/password (2.4 GHz network), backend URL,
   and the API key — **exactly** the same value as `ESP32_API_KEY`
   in `backend/.env`.
2. Arduino IDE → install the **esp32** board package and the
   **ArduinoJson** library.
3. Open `firmware/parqco_sensor.ino`, select your ESP32 board + port, flash.
4. Open Serial Monitor at **115200 baud**. You should see WiFi connect,
   then a line per reading like:
   `[A1] occupied=1 dist=42cm -> HTTP 200`
   `HTTP 200` = the backend accepted the reading. `401` = API key
   mismatch. No line / timeouts = WiFi or backend-URL problem.

## How the firmware behaves (for the viva)

- Samples each sensor every 2 s (`READ_INTERVAL_MS`); a state change is
  only reported after repeated matching reads (debounce in the sketch),
  so one stray echo doesn't flip a slot.
- Re-sends current state every 60 s as a heartbeat (`HEARTBEAT_MS`), so
  the backend's `lastSeenAt` shows whether a sensor has gone silent.
- A 30 ms echo timeout returns "no reading" rather than a false
  distance, so a disconnected sensor doesn't fake an empty slot.

## No hardware handy?

Use Demo Mode instead (Admin panel → Demo Mode, or
`POST /api/admin/demo-mode`). The backend simulates slot changes so the
dashboard, bookings, and predictions all work live. In the viva, say
plainly that the live demo used the simulator and the firmware was
tested separately — do not claim simulated data is sensor data.
