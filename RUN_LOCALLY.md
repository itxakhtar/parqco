# PARQCO — Run It Locally (Lesson)

This guide teaches you to run the whole system on your own computer.
Read it top to bottom once, then follow the steps. Estimated time: 20 minutes.

## Lesson 0 — What "running" actually means

PARQCO is not one program, it is **four programs that talk to each other**:

```
ESP32 (or demo simulator)
        │  POST /api/sensor-data
        ▼
Node.js backend (:5000) ──► MongoDB (database)
        │                         ▲
        │  GET /predict           │  reads history
        ▼                         │
Python ML service (:8000) ────────┘
        ▲
        │  REST + live socket updates
        ▼
React frontend (:5173)  ◄── you click here
```

**Key idea:** start them in dependency order — database first, then the two
servers, then the frontend. If the backend starts before MongoDB is reachable,
it will crash with `Missing required env var` or a connection error. That is
normal — it is telling you what is missing.

## Lesson 1 — Check your tools

Open a terminal and run:

```bash
node -v     # need v20 or higher
python --version   # need 3.10 or higher (3.11 ideal)
```

- No Node? Install from nodejs.org (LTS).
- No Python? Install from python.org, and tick **"Add python.exe to PATH"**.
- MongoDB: **skip installing it.** We will use MongoDB Atlas (free cloud
  database) even for local development. One less thing to install, and you
  need Atlas for the real deploy anyway. Follow DEPLOY.md step 1 to get your
  connection string.

> Windows note: where this guide says `cp`, use `copy`. Where it says
> `uvicorn`, use `python -m uvicorn`.

## Lesson 2 — The four secret files

Every program reads its settings from a `.env` file (or `config.h` for the
ESP32). The repo ships `.env.example` templates — copy each one, then fill
in the blanks. **For local running you only need:**

**`backend/.env`**
```bash
cp backend/.env.example backend/.env
```
Fill in:
- `MONGO_URI` — your Atlas connection string (the only real key needed locally)
- `JWT_SECRET` — invent anything long, e.g. `my-dev-secret-12345`
- `ESP32_API_KEY` — invent anything long, e.g. `dev-key-12345`
- `ML_SERVICE_URL=http://localhost:8000`
- `CORS_ORIGIN=http://localhost:5173`
- `ADMIN_EMAIL=admin@parqco.local` / `ADMIN_PASSWORD=admin123` (your login)
- `DEMO_MODE=false`

**`ml-service/.env`**
```bash
cp ml-service/.env.example ml-service/.env
```
Fill in: `MONGO_URI` — the **same** Atlas string.

**`frontend/.env`**
```bash
cp frontend/.env.example frontend/.env
```
Fill in: `VITE_API_URL=http://localhost:5000`

**`firmware/config.h`** — not needed until you flash real hardware. Skip for now.

> Teacher's rule: `.env` files are **never** committed to git. The `.gitignore`
> already excludes them. If you ever paste a real key into a tracked file,
> tell me and we will clean the git history.

## Lesson 3 — Start the servers (4 terminals)

**Terminal 1 — ML service** (start first; it is independent):
```bash
cd parqco/ml-service
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```
✅ Checkpoint: open http://127.0.0.1:8000/health → `{"ok":true,"modelLoaded":false}`
(`modelLoaded:false` is correct — no model exists yet. Lesson 5 fixes that.)

**Terminal 2 — Backend:**
```bash
cd parqco/backend
npm install
npm start
```
✅ Checkpoint: you see `MongoDB connected` and `PARQCO backend on :5000`.
Open http://localhost:5000/api/health → `{"ok":true,"service":"parqco-backend"}`.

**Terminal 3 — Frontend:**
```bash
cd parqco/frontend
npm install
npm run dev
```
✅ Checkpoint: open http://localhost:5173 — the PARQCO login page appears.

**Terminal 4** — keep free for the test commands in Lesson 6.

## Lesson 4 — Log in and wake up the AI

1. Open http://localhost:5173, log in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Go to **Admin → "Generate sample history + train"** and click it.
   Wait ~30 seconds. What just happened: the ML service wrote 28 days of
   realistic parking history (5,376 readings) into MongoDB and trained a
   RandomForest model on it. This solves the "cold start" problem from your
   SRS — a prediction system with no history cannot predict.
3. Go to **AI Predictions**. You should see a 24-hour occupancy bar chart and
   a message like *"Parking occupancy will reach 86% around 6 PM"*.
4. Go to **Admin → Enable demo mode**. The backend now pretends to be an ESP32,
   flipping slot states every 8 seconds.
5. Go to **Live Map**. Watch the grid change in real time — that is Socket.io
   pushing updates the instant the "sensor" reports. This is your whole system
   working with zero hardware.

## Lesson 5 — Understand the data flow (read this once)

1. A sensor reading arrives at `POST /api/sensor-data` (protected by your
   `ESP32_API_KEY` — try a wrong key and you get `401`; that is the security
   requirement from your SRS working).
2. The backend updates the `slots` collection (live state) and appends to
   `sensordata` (history).
3. Every connected browser instantly gets `slots:update` over the socket.
4. The ML service aggregates `sensordata` by hour/day-of-week and predicts.

## Lesson 6 — Prove it yourself (terminal 4)

```bash
# 1. Create a user and grab a token
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ali","email":"ali@test.com","password":"secret12"}'

# 2. Fake an ESP32 reading (this is exactly what the firmware sends)
curl -s -X POST http://localhost:5000/api/sensor-data \
  -H "Content-Type: application/json" -H "x-api-key: dev-key-12345" \
  -d '{"sensorId":"esp32-01","slotId":"A1","occupied":true,"distanceCm":42}'

# 3. See it live
curl -s http://localhost:5000/api/slots/stats
```

## Lesson 7 — When it breaks (it will, and that is fine)

| Symptom | Meaning | Fix |
|---------|---------|-----|
| `Missing required env var: MONGO_URI` | `.env` file missing or empty | Lesson 2 — copy the example and fill it |
| Backend exits immediately, Mongo error | Atlas blocks your IP | Atlas → Network Access → allow `0.0.0.0/0` |
| `modelLoaded:false` forever | Never seeded | Lesson 4, step 2 |
| Predictions page: "No prediction data yet" | ML has no trained model | Lesson 4, step 2 |
| Frontend blank / network errors | `VITE_API_URL` wrong | Must be `http://localhost:5000`, then **restart** `npm run dev` (Vite bakes it at start) |
| Port already in use | Old server still running | Close the old terminal or kill the process |
| `pip install` fails on Windows | Missing C++ build tools | `pip install` only needs them for some packages; try `python -m pip install --upgrade pip` first |

## Homework

- [ ] Book a slot as a normal user, then try to double-book the same time — you should get a `409` conflict. (That is your booking requirement, tested.)
- [ ] Turn demo mode off, `POST` a few `/api/sensor-data` readings by hand, watch the Live Map.
- [ ] Break something on purpose (wrong API key, bad `MONGO_URI`) and read the error. Error messages are documentation.
- [ ] When this all feels easy, open DEPLOY.md — it is the same system, just on cloud computers.
