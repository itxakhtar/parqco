# PARQCO — API Documentation

Base URL (production): `https://parqco.onrender.com`
All responses are JSON. Errors return `{ "error": "<message>" }` with a
matching HTTP status. Auth uses `Authorization: Bearer <JWT>` unless
noted. Sensor ingestion uses the `x-api-key: <ESP32_API_KEY>` header.

## Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok: true, service: "parqco-backend" }` |

## Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Body `{name, email, password}` → creates a `user` account, returns JWT |
| POST | `/api/auth/login` | — | Body `{email, password}` → returns JWT + user |
| GET | `/api/auth/me` | JWT | Current user's profile |

## Slots — `/api/slots`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/slots` | — | All slots with live status, sensorId, lastSeenAt |
| GET | `/api/slots/stats` | — | Totals: slots, available, occupied, occupancy % |
| POST | `/api/slots` | JWT + admin | Create a slot `{slotId, label, zone}` |
| PATCH | `/api/slots/:slotId` | JWT + admin | Update a slot |
| DELETE | `/api/slots/:slotId` | JWT + admin | Remove a slot |

## Sensor ingestion

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/sensor-data` | `x-api-key` | ESP32 reading `{sensorId, slotId, occupied, distanceCm}` → updates slot + appends history, emits Socket.io update |

## Bookings — `/api/bookings`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/bookings` | JWT | The caller's bookings |
| POST | `/api/bookings` | JWT | Book `{slotId, startTime, endTime}` |
| DELETE | `/api/bookings/:id` | JWT | Cancel the caller's booking |
| POST | `/api/bookings/sweep` | JWT + admin | Mark expired bookings completed |

## Predictions — `/api/predictions` (proxied to the ML service)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/predictions?hours=24` | — | Hourly forecast: time, occupancyPct, availableSlots (hours clamped 1–72) |
| GET | `/api/predictions/peak` | — | Predicted peak window for the next 24 h |

Returns 503 from the ML service until a model has been trained
(seed or train first — see Admin).

## Admin — `/api/admin` (JWT + admin on all)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/seed` | Generate 28 days of simulated history + train the model |
| POST | `/api/admin/train` | Retrain the model on current sensor history |
| POST / GET | `/api/admin/demo-mode` | Toggle / read the built-in sensor simulator |
| POST | `/api/admin/ensure-admin` | Idempotently ensure the configured admin account exists |

## ML service (direct, internal)

Base URL: the Render `parqco-ml` service. Endpoints: `GET /health`
(`{ok, modelLoaded}`), `POST /seed`, `POST /train`,
`GET /predict?hours=24`, `GET /peak`. The backend reaches it via the
`ML_SERVICE_URL` environment variable.

## Real-time (Socket.io)

Connect to the backend origin. Events:

| Event | Payload | When |
|---|---|---|
| `slots:update` | Updated slot list | Any sensor reading / slot change |
| `stats:update` | Totals + occupancy % | Same |
