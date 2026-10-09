# PARQCO — Architecture

## System in one paragraph

ESP32 units with HC-SR04 ultrasonic sensors watch individual parking
slots and POST occupancy readings over WiFi to a Node.js/Express
backend. The backend stores readings and slot state in MongoDB Atlas,
pushes live updates to the React frontend over Socket.io, and delegates
forecasting to a Python (FastAPI + scikit-learn) ML service that reads
the same database. Users register, log in (JWT), view the live slot
map, book slots, and see AI occupancy predictions; admins manage slots,
seed/train the model, and toggle a demo simulator.

## Components

| Component | Tech | Where it runs (production) | Source |
|---|---|---|---|
| Frontend | React + Vite, react-router, Socket.io client | Vercel — parqco.vercel.app | `frontend/` |
| Backend | Node.js + Express, Mongoose, Socket.io, bcrypt, JWT, express-rate-limit | Render — parqco.onrender.com | `backend/` |
| ML service | Python, FastAPI, scikit-learn (RandomForest), pymongo | Render (second service) | `ml-service/` |
| Database | MongoDB Atlas (free M0) | Atlas cloud | — |
| Firmware | Arduino C++ (ESP32) | Physical ESP32 per sensor group | `firmware/` |

## Data flow

1. **Sense:** ESP32 samples each HC-SR04 every 2 s, debounces state
   changes, POSTs `{sensorId, slotId, occupied, distanceCm}` to
   `POST /api/sensor-data` with the `x-api-key` header.
2. **Store:** Backend validates the API key, updates the `Slot`
   document (status, lastSeenAt) and appends a `SensorData` reading.
3. **Push:** Backend emits `slots:update` / `stats:update` over
   Socket.io; open dashboards update without refreshing.
4. **Predict:** ML service aggregates `sensordata` history per
   (day-of-week, hour), trains a RandomForest on
   [hour sin/cos, day-of-week, is-weekend], and serves `/predict`
   and `/peak`. The backend proxies these at `/api/predictions`.
5. **Book:** Logged-in users create `Booking` records; overlapping
   active bookings for the same slot/time are rejected by the
   slot+time index and route checks.

## Collections (MongoDB)

| Collection | Purpose | Key fields |
|---|---|---|
| `users` | Accounts | name, email (unique), passwordHash (bcrypt — never plain text), role: user/admin |
| `slots` | Current slot state | slotId (unique, e.g. "A1"), label, zone, status: available/occupied, sensorId, lastDistanceCm, lastSeenAt |
| `sensordata` | Append-only occupancy history — the ML training data | slotId, sensorId, occupied, distanceCm, at |
| `bookings` | Reservations | user (ref), slotId, startTime, endTime, status: active/cancelled/completed |

History is its own collection of small documents (not an array inside
`slots`), so it can grow without bloating slot records.

## Security decisions

- Passwords hashed with bcrypt; JWT for session auth; role middleware
  (`auth`, `adminOnly`) on protected/admin routes.
- Sensor ingestion is **not** open: it requires the shared
  `ESP32_API_KEY` header, so anyone cannot fake occupancy.
- Secrets live only in platform env vars / local `.env` files
  (git-ignored); the frontend only ever receives `VITE_API_URL`.
- API rate limiting (300 req/min per IP). Behind Render's proxy the
  backend sets `trust proxy = 1` so `express-rate-limit` reads
  `X-Forwarded-For` correctly instead of throwing
  `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.

## Known simplifications (state these honestly)

- **Booking vs SRS:** the SRS lists booking as future scope; the SDD
  treats it as core. PARQCO implements it (SDD wins — decision
  recorded in the traceability matrix).
- **Protocol:** SRS/SDD disagree on HTTP vs MQTT; REST over HTTP was
  chosen — simpler on free tiers, and the ESP32 library support is
  solid. MQTT remains future work.
- **Notifications:** in-dashboard alerts only; no email/SMS/push.
- **Offline state:** a silent sensor is inferred from a stale
  `lastSeenAt`; there is no separate `offline` enum on slots.
- **Free-tier sleep:** the Render backend sleeps when idle, so the
  first request after idle can take ~40 s. Acceptable for an FYP demo;
  Demo Mode exists so a viva demo never depends on venue WiFi/hardware.
