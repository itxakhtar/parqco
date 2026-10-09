# PARQCO — Requirement Traceability Matrix

Maps each requirement area (SRS + SDD, consolidated in the master
development prompt of 2026-10-09) to its implementation and evidence.
Status is stated honestly — "Partial" and "Not built" are real answers;
claiming otherwise would collapse under supervisor questioning.

| # | Requirement | Implementation | Evidence / test | Status |
|---|---|---|---|---|
| 1 | User registration & login | `backend/src/routes/auth.js`, `frontend/src/pages/Login.jsx` | Executed end-to-end Oct 8 (register/login against live Atlas) | ✅ Done |
| 2 | Password security (hashing, never plain text) | bcrypt `passwordHash` in `backend/src/models/User.js` | Schema inspection; login tests | ✅ Done |
| 3 | JWT auth + protected routes | `backend/src/middleware/auth.js`, `Protected` in `frontend/src/App.jsx` | `/api/auth/me` with/without token tested Oct 8 | ✅ Done |
| 4 | Role-based access (user/admin) | `role` on User, `adminOnly` middleware, admin router guard | Admin-only seed/train exercised Oct 8 | ✅ Done |
| 5 | Live parking slot grid with available/occupied states | `frontend/src/pages/Dashboard.jsx`, `GET /api/slots`, Socket.io `slots:update` | Live dashboard verified Oct 8–9 | ✅ Done |
| 6 | Slot management by admin (create/update/delete, unique IDs) | `backend/src/routes/slots.js`, `slotId` unique index in `models/Slot.js` | API executed Oct 8 | ✅ Done |
| 7 | ESP32 + HC-SR04 occupancy sensing | `firmware/parqco_sensor.ino` (2 s sampling, debounce, 60 s heartbeat) | Code complete; **not yet flashed to physical hardware** | ⚠️ Partial — hardware test pending |
| 8 | Safe sensor wiring (5 V echo vs 3.3 V GPIO) | `docs/wiring-guide.md` (1 kΩ/2 kΩ divider) | Doc written Oct 9 | ✅ Done (doc) |
| 9 | Protected sensor ingestion | `POST /api/sensor-data` + `middleware/apiKey.js` (`x-api-key`) | Tested Oct 8; wrong key rejected | ✅ Done |
| 10 | Occupancy history storage | `backend/src/models/SensorData.js` (append-only, indexed by slot/time) | Seed + ingest wrote history Oct 8 | ✅ Done |
| 11 | Real-time updates (mechanism unspecified in SRS) | Socket.io — `backend/src/realtime.js`, events `slots:update`, `stats:update` | Dashboard updated live in tests | ✅ Done (Socket.io chosen — SRS gap) |
| 12 | Booking system | `backend/src/routes/bookings.js`, `models/Booking.js`, `pages/Booking.jsx` | Booking flow executed Oct 8 | ✅ Done — note: SRS says "future scope", SDD says core; SDD followed |
| 13 | AI occupancy predictions | `ml-service/app.py` — RandomForest on [hour sin/cos, dow, is-weekend]; `pages/Predictions.jsx` | Predictions served Oct 8 | ✅ Done |
| 14 | ML evaluation with honest metrics | `ml-service/evaluate.py`, `docs/ml-evaluation.md` | **Run Oct 9:** MAE 0.1354, RMSE 0.1734, R² 0.694 on a 7-day chronological holdout of *simulated* seed data | ✅ Done (simulated data — labelled as such) |
| 15 | Notifications on status changes | In-dashboard alerts only | — | ⚠️ Partial — no notifications collection/page, no email/SMS/push (SRS has the requirement; SDD has no module) |
| 16 | Admin dashboard (seed, train, demo mode) | `frontend/src/pages/Admin.jsx`, `backend/src/routes/admin.js` | Exercised Oct 8 | ✅ Done |
| 17 | Sensor simulator for hardware-free demo | `backend/src/demoSimulator.js`, Demo Mode toggle | Exercised Oct 8 | ✅ Done (clearly labelled simulation) |
| 18 | Deployment: Atlas + backend + frontend on free tiers | Atlas cluster live; Render backend live (`/api/health` OK, verified Oct 9 13:07 PKT); Vercel frontend live | Live checks Oct 9 | ⚠️ Partial — ML Render service not confirmed live; `ML_SERVICE_URL` not confirmed set |
| 19 | SPA routing on refresh / deep links | `frontend/vercel.json` rewrite to `/index.html` — **committed locally, not yet deployed**: direct load of `parqco.vercel.app/login` still returns Vercel 404 (verified twice, Oct 9 13:07 PKT) while root → login redirect works | Live check Oct 9 | ❌ Not live yet — needs push + Vercel redeploy |
| 20 | Backend behind proxy (rate-limit correctness) | `app.set('trust proxy', 1)` in `backend/src/server.js` — committed locally (commit 119d8e9) | Local code verified Oct 9; live deployment of this commit not confirmed | ⚠️ Partial — needs push + Render redeploy |
| 21 | Landing page, user profile page, parking-history page | — | — | ❌ Not built (login goes straight to dashboard) |
| 22 | Automated test suites (Jest/pytest) | Manual end-to-end execution only (auth, ingest, bookings, predictions — Oct 8) | No committed test files exist | ❌ Not built — honest gap for Phase 9 |
| 23 | Formal docs: architecture, API, setup | `docs/architecture.md`, `docs/api-documentation.md`, `README.md`, `DEPLOY.md`, `RUN_LOCALLY.md` | Written Oct 8–9 | ✅ Done |
| 24 | Offline sensor state | Inferred from stale `lastSeenAt` on Slot | — | ⚠️ Partial — no explicit `offline` status value |

## Document inconsistencies found (Phase 1, still current)

1. Booking: SRS = future scope, SDD = core feature → implemented (SDD).
2. Real-time mechanism: SRS promises real-time, defines none → Socket.io.
3. Sensor security: unspecified in both → shared API key added.
4. Notifications: in SRS, no corresponding SDD module → in-app only.
5. Protocol: SRS/SDD disagree HTTP vs MQTT → REST/HTTP chosen.
