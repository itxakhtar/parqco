"""
PARQCO ML evaluation — time-based holdout on SIMULATED seed data.

Reproduces the seed generator in app.py exactly (same hourly occupancy
probabilities, weekend factor 0.6, +/-0.08 noise, 8 slots, 28 days) and
uses the same feature set as _train_from_db() (hour sin/cos, day-of-week,
is-weekend). Buckets here are per (date, hour) so the holdout can be
chronological; the production model aggregates per (day-of-week, hour)
across all history instead. Then:

  - trains on days 28..8 ago (first 21 days)
  - tests on the last 7 days (chronological holdout — no shuffling,
    so no future information leaks into training)
  - compares the RandomForest model against two honest baselines:
    (a) global mean occupancy, (b) per-hour mean occupancy

Run:  python evaluate.py
Outputs MAE / RMSE / R2 for each model. These numbers describe the
SIMULATED seed data only — they are not accuracy claims about real
sensor history. Re-run against real data once the ESP32 has collected
several weeks of readings.
"""
import math
import random
from datetime import datetime, timedelta, timezone

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

random.seed(42)
np.random.seed(42)

HOURLY_P = [0.05, 0.04, 0.03, 0.03, 0.04, 0.06, 0.12, 0.28, 0.55, 0.75, 0.72,
            0.66, 0.62, 0.58, 0.55, 0.58, 0.66, 0.74, 0.86, 0.82, 0.62, 0.42,
            0.25, 0.12]
SLOTS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]
DAYS = 28
HOLDOUT_DAYS = 7


def gen_readings(days=DAYS):
    now = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    docs = []
    for d in range(days, 0, -1):
        day = now - timedelta(days=d)
        weekend = day.isoweekday() >= 6
        for h in range(24):
            p = HOURLY_P[h] * (0.6 if weekend else 1.0)
            for sid in SLOTS:
                occupied = random.random() < min(max(p + random.uniform(-0.08, 0.08), 0.01), 0.98)
                docs.append({"slotId": sid, "occupied": occupied, "at": day + timedelta(hours=h)})
    return docs


def bucketize(docs):
    """Aggregate to one row per (dow, hour): occupancy fraction — mirrors app.py."""
    groups = {}
    for doc in docs:
        dt = doc["at"]
        dow = dt.isoweekday() % 7 + 1  # Mongo $dayOfWeek: 1=Sun..7=Sat
        key = (dt.date(), dow, dt.hour)
        groups.setdefault(key, []).append(1 if doc["occupied"] else 0)
    rows = []
    for (date, dow, hour), vals in sorted(groups.items()):
        rows.append({"date": date, "dow": dow, "hour": hour, "occ": float(np.mean(vals))})
    return rows


def features(dow, hour):
    return [math.sin(2 * math.pi * hour / 24), math.cos(2 * math.pi * hour / 24),
            dow, 1 if dow in (1, 7) else 0]


def main():
    docs = gen_readings()
    rows = bucketize(docs)
    dates = sorted({r["date"] for r in rows})
    cutoff = dates[-HOLDOUT_DAYS]
    train = [r for r in rows if r["date"] < cutoff]
    test = [r for r in rows if r["date"] >= cutoff]
    print(f"readings={len(docs)} buckets: train={len(train)} test={len(test)} "
          f"(holdout = last {HOLDOUT_DAYS} days, chronological)")

    Xtr = np.array([features(r["dow"], r["hour"]) for r in train])
    ytr = np.array([r["occ"] for r in train])
    Xte = np.array([features(r["dow"], r["hour"]) for r in test])
    yte = np.array([r["occ"] for r in test])

    rf = RandomForestRegressor(n_estimators=120, random_state=42, n_jobs=-1)
    rf.fit(Xtr, ytr)
    pred_rf = np.clip(rf.predict(Xte), 0, 1)

    pred_mean = np.full_like(yte, ytr.mean())
    hour_mean = {}
    for r in train:
        hour_mean.setdefault(r["hour"], []).append(r["occ"])
    hour_mean = {h: float(np.mean(v)) for h, v in hour_mean.items()}
    pred_hour = np.array([hour_mean[r["hour"]] for r in test])

    def report(name, pred):
        mae = mean_absolute_error(yte, pred)
        rmse = math.sqrt(mean_squared_error(yte, pred))
        r2 = r2_score(yte, pred)
        print(f"{name:28s} MAE={mae:.4f} ({mae*100:.1f} pp)  RMSE={rmse:.4f}  R2={r2:.3f}")
        return mae, rmse, r2

    print("\nModel comparison on the 7-day holdout (occupancy fraction, 0-1):")
    report("RandomForest (PARQCO)", pred_rf)
    report("Baseline: per-hour mean", pred_hour)
    report("Baseline: global mean", pred_mean)


if __name__ == "__main__":
    main()
