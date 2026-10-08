# PARQCO — Deployment Runbook

Deploy the full system on free tiers: **MongoDB Atlas** (database) +
**Render** (backend + ML service) + **Vercel** (frontend). ~30 minutes.

## 0. What you need

- A GitHub account (code lives at `github.com/<you>/parqco`)
- A MongoDB Atlas account (free M0) — mongodb.com/atlas
- A Render account (free) — render.com
- A Vercel account (free) — vercel.com
- Arduino IDE + ESP32 board for the firmware step

## 1. Database — MongoDB Atlas

1. Create a free **M0** cluster (any region near you).
2. **Database Access** → add a user (e.g. `parqco`) with a strong password.
3. **Network Access** → allow `0.0.0.0/0` (needed for Render's dynamic IPs).
4. **Connect → Drivers → Node.js** → copy the connection string. It looks like:
   `mongodb+srv://parqco:<password>@cluster0.xxxxx.mongodb.net/parqco?retryWrites=true&w=majority`
5. Keep it — you paste it in steps 3 and 4.

## 2. Push code to GitHub

Create an **empty** repo named `parqco` at github.com/new (no README).
Then, in the project folder on your machine:

```bash
git remote add origin https://github.com/<your-username>/parqco.git
git branch -M main
git push -u origin main
```

## 3. Backend — Render (Node web service)

1. Render dashboard → **New → Web Service** → connect the `parqco` repo.
2. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - Plan: **Free**
3. **Environment** → add:
   | Key | Value |
   |-----|-------|
   | `MONGO_URI` | Atlas string from step 1 |
   | `JWT_SECRET` | long random string (`openssl rand -hex 32`) |
   | `ESP32_API_KEY` | another long random string — **save it, firmware needs the same value** |
   | `ML_SERVICE_URL` | from step 4 (add after) — use Render's internal URL, e.g. `http://parqco-ml:8000`, or the public URL |
   | `CORS_ORIGIN` | your Vercel URL from step 5 (add after), e.g. `https://parqco.vercel.app` |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | your admin login |
4. Deploy. Note the public URL, e.g. `https://parqco-api.onrender.com`.
   Test: `curl https://parqco-api.onrender.com/api/health` → `{"ok":true,...}`.

## 4. ML service — Render (Python web service)

1. **New → Web Service** → same repo.
2. Settings:
   - **Root Directory:** `ml-service`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - Plan: **Free**
3. **Environment:** `MONGO_URI` = same Atlas string.
4. Deploy, note its URL, and go back to step 3 to set `ML_SERVICE_URL`.

## 5. Frontend — Vercel

1. Vercel → **Add New → Project** → import the `parqco` repo.
2. **Root Directory:** `frontend`. Framework preset: **Vite**.
3. **Environment Variables** (set BEFORE deploying):
   - `VITE_API_URL` = backend public URL from step 3 (no trailing slash)
4. Deploy. Open the URL, log in with `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

> ⚠️ If you change `VITE_API_URL` later, you must **redeploy** — Vite bakes it in at build time.

## 6. First-run setup (in the app, as admin)

1. **Admin → Generate sample history + train** — creates 28 days of history
   and trains the prediction model (~30 seconds).
2. **Admin → Enable demo mode** (optional) — simulates sensors until hardware is live.
3. Check **AI Predictions** — you should see the 24h occupancy chart and a peak message.

## 7. ESP32 firmware

1. `cp firmware/config.example.h firmware/config.h` and fill in:
   - `WIFI_SSID` / `WIFI_PASSWORD` — 2.4 GHz WiFi
   - `BACKEND_URL` — e.g. `"https://parqco-api.onrender.com"` (no trailing slash)
   - `API_KEY` — **exactly** the `ESP32_API_KEY` from step 3
   - Adjust `NUM_SLOTS`, pins, and `SLOT_IDS` for your wiring
2. Arduino IDE → install **esp32** board package + **ArduinoJson** library.
3. Select board + port → Upload. Open Serial Monitor (115200) to watch readings.
4. Disable demo mode in Admin — live sensor data takes over.

## 8. Verify production

```bash
API=https://parqco-api.onrender.com
curl $API/api/health
curl $API/api/slots/stats
curl "$API/api/predictions?hours=24" | head -c 200
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Frontend shows network errors | `VITE_API_URL` wrong or not redeployed after changing it |
| CORS errors in browser console | `CORS_ORIGIN` must exactly match the Vercel URL (no trailing slash) |
| Predictions page: "No prediction data yet" | Admin → Generate sample history + train |
| ESP32 HTTP -1 / connection failed | Backend URL must be `https://` public URL; check WiFi (2.4 GHz) |
| ESP32 HTTP 401 | `API_KEY` in `config.h` ≠ `ESP32_API_KEY` in backend env |
| Backend won't start | Check Render logs — usually a missing env var (`MONGO_URI`, `JWT_SECRET`, `ESP32_API_KEY` are required) |
| Render free tier sleeps | First request after idle takes ~50s to wake. For demo day, hit `/api/health` a few minutes early |

## Demo-day checklist

- [ ] Hit `/api/health` 5 min before to wake Render
- [ ] Decide: hardware live **or** Admin → demo mode ON (not both fighting)
- [ ] Backup: screen-record one full walkthrough the night before
- [ ] Phone hotspot as backup WiFi for the ESP32
