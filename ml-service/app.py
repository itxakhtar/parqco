"""
PARQCO ML service — parking occupancy prediction.

Endpoints:
  GET  /health
  POST /seed          generate 28 days of realistic sample history + train
  POST /train         (re)train the model on current sensor history
  GET  /predict?hours=24   occupancy forecast for the next N hours
  GET  /peak          predicted peak window for the next 24h

Model: RandomForestRegressor on [hour_sin, hour_cos, day_of_week, is_weekend]
trained on per-(dow,hour) occupancy fractions from the sensordata collection.
"""
import os
import math
import random
from datetime import datetime, timedelta, timezone

import joblib
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pymongo import MongoClient
from sklearn.ensemble import RandomForestRegressor

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://mongo:27017/parqco")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

client = MongoClient(MONGO_URI)
db = client.get_database("parqco")

app = FastAPI(title="PARQCO ML service")
_model = None       # trained regressor
_total_slots = 8    # slots the model was trained for


# ---------- features ----------

def _features_for(dt: datetime):
    """Feature vector for a datetime. dow uses Mongo $dayOfWeek (1=Sun..7=Sat)."""
    hour = dt.hour
    dow = dt.isoweekday() % 7 + 1
    return [
        math.sin(2 * math.pi * hour / 24),
        math.cos(2 * math.pi * hour / 24),
        dow,
        1 if dow in (1, 7) else 0,
    ]


def _load_model():
    global _model, _total_slots
    if _model is not None:
        return _model
    if not os.path.exists(MODEL_PATH):
        return None
    saved = joblib.load(MODEL_PATH)
    _model, _total_slots = saved["model"], saved["total_slots"]
    return _model


def _require_model():
    model = _load_model()
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="No trained model. POST /seed or POST /train first.",
        )
    return model


# ---------- training ----------

def _train_from_db():
    global _model, _total_slots
    pipeline = [
        {"$group": {
            "_id": {"dow": {"$dayOfWeek": "$at"}, "hour": {"$hour": "$at"}},
            "occ": {"$avg": {"$cond": ["$occupied", 1, 0]}},
            "n": {"$sum": 1},
        }},
        {"$match": {"n": {"$gte": 3}}},  # ignore nearly-empty buckets
    ]
    rows = list(db.sensordata.aggregate(pipeline))
    if len(rows) < 10:
        raise HTTPException(status_code=503, detail="Not enough history to train (need sensor data first).")

    X, y = [], []
    for r in rows:
        hour, dow = r["_id"]["hour"], r["_id"]["dow"]
        X.append([
            math.sin(2 * math.pi * hour / 24),
            math.cos(2 * math.pi * hour / 24),
            dow,
            1 if dow in (1, 7) else 0,
        ])
        y.append(r["occ"])

    model = RandomForestRegressor(n_estimators=120, random_state=42, n_jobs=-1)
    model.fit(np.array(X), np.array(y))

    total = db.slots.count_documents({}) or 8
    joblib.dump({"model": model, "total_slots": total}, MODEL_PATH)
    _model, _total_slots = model, total
    return {"trainedOnBuckets": len(rows), "totalSlots": total,
            "trainedAt": datetime.now(timezone.utc).isoformat()}


# ---------- seed data ----------

# Realistic occupancy probability by hour (0-23): morning + evening peaks.
_HOURLY_P = [0.05, 0.04, 0.03, 0.03, 0.04, 0.06, 0.12, 0.28, 0.55, 0.75, 0.72,
             0.66, 0.62, 0.58, 0.55, 0.58, 0.66, 0.74, 0.86, 0.82, 0.62, 0.42,
             0.25, 0.12]
_DEFAULT_SLOTS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]


def _seed_history(days: int = 28):
    slot_ids = [s["slotId"] for s in db.slots.find({}, {"slotId": 1})]
    if not slot_ids:
        slot_ids = _DEFAULT_SLOTS
        for sid in slot_ids:
            db.slots.update_one({"slotId": sid},
                                {"$setOnInsert": {"slotId": sid, "label": sid,
                                                  "zone": sid[0], "status": "available"}},
                                upsert=True)

    db.sensordata.delete_many({})  # start clean so re-seeding is idempotent
    now = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    docs = []
    for d in range(days, 0, -1):
        day = now - timedelta(days=d)
        weekend = day.isoweekday() >= 6
        for h in range(24):
            p = _HOURLY_P[h] * (0.6 if weekend else 1.0)
            for sid in slot_ids:
                occupied = random.random() < min(max(p + random.uniform(-0.08, 0.08), 0.01), 0.98)
                docs.append({
                    "slotId": sid,
                    "sensorId": "seed-generator",
                    "occupied": occupied,
                    "distanceCm": random.randint(20, 60) if occupied else random.randint(120, 250),
                    "at": day + timedelta(hours=h),
                })
    if docs:
        db.sensordata.insert_many(docs)
    return {"days": days, "slots": len(slot_ids), "readings": len(docs)}


# ---------- routes ----------

@app.get("/health")
def health():
    return {"ok": True, "modelLoaded": _load_model() is not None}


@app.post("/seed")
def seed():
    info = _seed_history()
    info["train"] = _train_from_db()
    return {"ok": True, **info}


@app.post("/train")
def train():
    return {"ok": True, **_train_from_db()}


def _forecast(hours: int):
    model = _require_model()
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    out = []
    for i in range(1, hours + 1):
        dt = now + timedelta(hours=i)
        occ = float(model.predict([_features_for(dt)])[0])
        occ = min(max(occ, 0.0), 1.0)
        out.append({
            "time": dt.isoformat(),
            "occupancyPct": round(occ * 100),
            "availableSlots": round(_total_slots * (1 - occ)),
            "totalSlots": _total_slots,
        })
    return out


@app.get("/predict")
def predict(hours: int = 24):
    hours = min(max(hours, 1), 72)
    return {"generatedAt": datetime.now(timezone.utc).isoformat(),
            "predictions": _forecast(hours)}


@app.get("/peak")
def peak():
    fc = _forecast(24)
    top = max(fc, key=lambda p: p["occupancyPct"])
    start = datetime.fromisoformat(top["time"])
    return {
        "peakStart": start.isoformat(),
        "peakEnd": (start + timedelta(hours=2)).isoformat(),
        "occupancyPct": top["occupancyPct"],
        "message": f"Parking occupancy will reach {top['occupancyPct']}% "
                   f"around {start.strftime('%I %p').lstrip('0')}",
    }
