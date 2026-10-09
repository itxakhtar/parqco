# PARQCO — ML Evaluation Report

**What this is:** a reproducible, time-based holdout evaluation of the prediction
model, run on 2026-10-09 with the script `ml-service/evaluate.py`.
**What this is not:** an accuracy claim about real parking behaviour. All data
below is the *simulated seed data* the system generates for development
(`ml-service/app.py`, `_seed_history`). Re-run the same script against real
sensor history once the ESP32 has collected several weeks of readings, and
quote those numbers instead.

## Method

- Seed data reproduced exactly: 28 days × 24 hours × 8 slots = **5,376 readings**,
  hourly occupancy probabilities from `app.py` (morning/evening peaks),
  weekend factor ×0.6, ±0.08 random noise, random seed fixed (42).
- Features (same as production): hour as sin/cos, day-of-week, is-weekend.
- Split is **chronological, not shuffled**: train on the first 21 days
  (504 hourly buckets), test on the last 7 days (168 hourly buckets).
  Shuffling time-series data would leak the future into training and
  inflate the scores — a point worth making in the viva.
- Target: occupancy fraction for that hour (0–1).

## Results (7-day holdout)

| Model | MAE | RMSE | R² |
|---|---|---|---|
| **RandomForest (PARQCO, 120 trees)** | **0.1354 (13.5 pp)** | **0.1734** | **0.694** |
| Baseline: per-hour mean | 0.1400 (14.0 pp) | 0.1816 | 0.665 |
| Baseline: global mean | 0.2761 (27.6 pp) | 0.3136 | −0.000 |

MAE is in occupancy-fraction units; "pp" = percentage points of occupancy.

## How to read this in the viva

- The model explains ~69% of the variance in hourly occupancy (R² = 0.694)
  and beats both baselines — but only *slightly* beats the per-hour-mean
  baseline (MAE 13.5 vs 14.0 pp). That is expected and honest: with only
  hour/day features, most of the signal *is* the daily pattern. The model's
  edge comes from the weekend interaction.
- The global-mean baseline's R² ≈ 0 confirms the split and metrics are
  sane — a model that just predicts the average explains nothing.
- Limitation to state openly: 8 slots make each hourly bucket coarse
  (steps of 12.5%), which puts a floor under achievable MAE. More slots
  and real data would sharpen this.

## Reproduce

```bash
cd ml-service
pip install -r requirements.txt scikit-learn numpy
python evaluate.py
```
