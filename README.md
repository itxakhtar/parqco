# PARQCO — Smart Parking Management System with AI Predictions

IoT + AI parking system: ESP32 & ultrasonic sensors detect slot occupancy,
a Node.js/Express backend stores data in MongoDB, a Python ML service predicts
future occupancy, and a React dashboard shows everything live.

## Repo layout

```
parqco/
├── backend/        Node.js + Express + Socket.io API
├── ml-service/     Python FastAPI — training, prediction, seed data
├── frontend/       React (Vite) dashboard
├── firmware/       ESP32 Arduino sketch (HC-SR04 sensors)
├── docker-compose.yml
└── README.md
```

## Quick start (local dev)

```bash
# 1. Fill in the env files (see "Where to paste your keys" below)
cp backend/.env.example backend/.env
cp ml-service/.env.example ml-service/.env
cp frontend/.env.example frontend/.env

# 2. Start everything (includes a local MongoDB for development)
docker compose up --build

# 3. Open the app
#    Frontend: http://localhost:8080
#    Backend:  http://localhost:5000/api/health
#    ML:       http://localhost:8000/health
```

Default admin account is created automatically on first backend start from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`.

## Where to paste your keys (the ONLY places with secrets)

You only need keys in **4 files**. Nothing else contains secrets.

| # | File | What to paste |
|---|------|---------------|
| 1 | `backend/.env` | `MONGO_URI` — your MongoDB Atlas connection string (production). `JWT_SECRET` — any long random string you invent. `ESP32_API_KEY` — any long random string you invent (must match firmware). `ML_SERVICE_URL` — URL of the ML service. `CORS_ORIGIN` — your frontend URL. `ADMIN_EMAIL` / `ADMIN_PASSWORD` — for the first admin login. |
| 2 | `ml-service/.env` | `MONGO_URI` — **same** Atlas connection string as backend. |
| 3 | `frontend/.env` | `VITE_API_URL` — public URL of your backend, e.g. `https://parqco-api.onrender.com`. `VITE_SOCKET_URL` — same as above (only if different). |
| 4 | `firmware/config.h` | `WIFI_SSID` / `WIFI_PASSWORD` — the WiFi the ESP32 joins. `BACKEND_URL` — e.g. `https://parqco-api.onrender.com`. `API_KEY` — **exactly the same value** as `ESP32_API_KEY` in `backend/.env`. |

Generate random secrets with:
```bash
openssl rand -hex 32
```

There are **no third-party API keys** needed — no Stripe, no Google Maps, no paid
services. MongoDB Atlas (free tier) is the only external account required.

## Production deployment (free tier)

1. **Database** — MongoDB Atlas: create a free M0 cluster, add a database user,
   allow network access, copy the connection string into `backend/.env` and
   `ml-service/.env` as `MONGO_URI`.
2. **Backend** — Render/Railway/Fly.io: deploy `backend/` as a Node web service.
   Set all `backend/.env` vars in the provider's dashboard. Note the public URL.
3. **ML service** — same provider: deploy `ml-service/` as a second service
   (Python). Set `ML_SERVICE_URL` in the backend to its internal/public URL.
4. **Frontend** — Vercel/Netlify: deploy `frontend/`. Set `VITE_API_URL` to the
   backend's public URL. Redeploy after changing it.
5. **ESP32** — copy `firmware/config.example.h` to `firmware/config.h`, fill in
   the 4 values, flash with Arduino IDE (ESP32 board + `ArduinoJson` library).

## Demo-day safety

If the venue WiFi is unreliable, an admin can enable **Demo Mode** from the
Admin panel (or `POST /api/admin/demo-mode`). The backend then simulates slot
changes itself so the dashboard, bookings, and predictions all work live
without hardware.

## API overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | — | Create account |
| POST | /api/auth/login | — | Login, returns JWT |
| GET | /api/slots | — | All slots + live status |
| POST | /api/sensor-data | API key | ESP32 pushes readings |
| GET/POST | /api/bookings | JWT | Book / list bookings |
| GET | /api/predictions?hours=24 | — | Occupancy forecast |
| GET | /api/predictions/peak | — | Predicted peak window |
| GET | /api/stats | — | Totals + occupancy % |
| POST | /api/admin/seed | admin | Generate sample history |
| POST | /api/admin/train | admin | Retrain ML model |
| POST | /api/admin/demo-mode | admin | Toggle sensor simulator |

Socket.io events: `slots:update`, `stats:update`.
