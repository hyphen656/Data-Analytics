# Prediction Models

## Design Philosophy

Prediction models are decoupled from the dashboard display layer. All models write their output to the `predictions` table as JSON. Dashboard components read from that table — they never compute predictions themselves. This means the computation backend can evolve from SQL to a full ML pipeline without touching any frontend code.

Model versioning is encoded in the `model_type` column (e.g. `churn_v1`, `churn_v2`). Multiple versions can coexist in the table, and the dashboard queries for the latest row per user per model type.

---

## V1: SQL Window Functions

V1 models run entirely in Postgres using window functions and aggregates. No external services required. Executed by the `run-predictions` Edge Function on a scheduled basis, or triggered on-demand.

### Moving Averages

Used to smooth event count and session count time series before trend comparison.

```sql
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(*) AS daily_events,
  AVG(COUNT(*)) OVER (
    ORDER BY date_trunc('day', created_at)
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_7d_avg
FROM events
WHERE clerk_user_id = $1
  AND created_at >= now() - interval '60 days'
GROUP BY 1
ORDER BY 1;
```

The 7-day rolling average is used in the Trends view to smooth daily noise and expose the underlying direction.

### Week-over-Week Growth

```sql
WITH weekly AS (
  SELECT
    date_trunc('week', created_at) AS week,
    COUNT(DISTINCT clerk_user_id) AS active_users
  FROM events
  WHERE created_at >= now() - interval '12 weeks'
  GROUP BY 1
)
SELECT
  week,
  active_users,
  LAG(active_users) OVER (ORDER BY week) AS prev_week,
  ROUND(
    100.0 * (active_users - LAG(active_users) OVER (ORDER BY week))
    / NULLIF(LAG(active_users) OVER (ORDER BY week), 0),
    1
  ) AS wow_pct_change
FROM weekly
ORDER BY week DESC;
```

### Funnel Drop-off

```sql
WITH step_counts AS (
  SELECT
    step_index,
    step_event,
    COUNT(DISTINCT clerk_user_id) AS reached
  FROM (
    SELECT
      ordinal - 1 AS step_index,
      step_event,
      e.clerk_user_id
    FROM jsonb_array_elements_text(
      (SELECT steps FROM funnels WHERE id = $funnel_id)
    ) WITH ORDINALITY AS s(step_event, ordinal)
    JOIN events e ON e.event_type = s.step_event
    WHERE e.created_at >= now() - interval '30 days'
  ) sub
  GROUP BY 1, 2
)
SELECT
  step_index,
  step_event,
  reached,
  FIRST_VALUE(reached) OVER (ORDER BY step_index) AS baseline,
  ROUND(100.0 * reached / FIRST_VALUE(reached) OVER (ORDER BY step_index), 1) AS pct_of_start,
  ROUND(100.0 * (1 - reached::numeric / NULLIF(LAG(reached) OVER (ORDER BY step_index), 0)), 1) AS drop_off_pct
FROM step_counts
ORDER BY step_index;
```

### Cohort Retention

```sql
WITH cohorts AS (
  SELECT
    clerk_user_id,
    date_trunc('week', MIN(created_at)) AS cohort_week
  FROM events
  WHERE event_type = 'sign_up'
  GROUP BY 1
),
activity AS (
  SELECT
    e.clerk_user_id,
    date_trunc('week', e.created_at) AS activity_week
  FROM events e
  GROUP BY 1, 2
)
SELECT
  c.cohort_week,
  COUNT(DISTINCT c.clerk_user_id) AS cohort_size,
  COUNT(DISTINCT CASE WHEN a.activity_week = c.cohort_week + interval '1 week' THEN a.clerk_user_id END) AS week_1,
  COUNT(DISTINCT CASE WHEN a.activity_week = c.cohort_week + interval '2 weeks' THEN a.clerk_user_id END) AS week_2,
  COUNT(DISTINCT CASE WHEN a.activity_week = c.cohort_week + interval '4 weeks' THEN a.clerk_user_id END) AS week_4,
  COUNT(DISTINCT CASE WHEN a.activity_week = c.cohort_week + interval '8 weeks' THEN a.clerk_user_id END) AS week_8
FROM cohorts c
LEFT JOIN activity a USING (clerk_user_id)
GROUP BY 1
ORDER BY 1 DESC;
```

---

## V2: Time-Series Forecasting via Edge Function

V2 extends the `run-predictions` Edge Function to produce forward-looking forecasts, not just historical summaries.

### Approach

1. The Edge Function queries the last 90 days of daily event counts and session counts per user
2. It sends this time series to a forecasting endpoint (options: a self-hosted Python service running Prophet or statsforecast, or a third-party API)
3. The forecast response (next 30 and 90 days with confidence intervals) is written to the `predictions` table as `model_type = 'revenue_forecast_v1'`

### Payload shape

Input to forecasting service:
```json
{
  "series": [
    { "ds": "2026-01-01", "y": 4 },
    { "ds": "2026-01-02", "y": 7 }
  ],
  "horizon": 30
}
```

Output stored in `predictions.prediction`:
```json
{
  "forecast": [
    { "ds": "2026-02-09", "yhat": 5.2, "yhat_lower": 3.1, "yhat_upper": 7.4 }
  ],
  "trend": "growing",
  "confidence": 0.78
}
```

### Migration path from V1

V1 trend data already lives in the `predictions` table under `model_type = 'engagement_trend_v1'`. When V2 is deployed, a new `model_type` value is added. The dashboard's prediction panel queries the most recent row per `(clerk_user_id, model_type)` — so V1 and V2 predictions can coexist during a rollout, and the UI can show whichever is fresher.

---

## Churn Model: Inactivity Scoring

### V1: Rule-based inactivity score

The churn model assigns every user a score from 0.0 to 1.0 based on session gap patterns. A higher score means higher churn risk.

```sql
WITH last_activity AS (
  SELECT
    clerk_user_id,
    MAX(created_at) AS last_event_at,
    EXTRACT(EPOCH FROM (now() - MAX(created_at))) / 86400 AS days_inactive
  FROM events
  GROUP BY 1
),
session_stats AS (
  SELECT
    clerk_user_id,
    COUNT(*) AS total_sessions,
    AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60) AS avg_duration_min
  FROM sessions
  WHERE ended_at IS NOT NULL
  GROUP BY 1
)
SELECT
  la.clerk_user_id,
  la.days_inactive,
  ss.total_sessions,
  ss.avg_duration_min,
  LEAST(1.0, GREATEST(0.0,
    -- Base score from inactivity
    CASE
      WHEN la.days_inactive > 30 THEN 0.9
      WHEN la.days_inactive > 14 THEN 0.6
      WHEN la.days_inactive > 7  THEN 0.3
      ELSE 0.1
    END
    -- Adjust down for users with strong engagement history
    - CASE WHEN ss.total_sessions > 20 THEN 0.15 ELSE 0 END
    - CASE WHEN ss.avg_duration_min > 10 THEN 0.1 ELSE 0 END
  )) AS churn_score
FROM last_activity la
LEFT JOIN session_stats ss USING (clerk_user_id);
```

### Score interpretation

| Score range | Risk level | Recommended action |
|---|---|---|
| 0.0 – 0.3 | Low | No action |
| 0.3 – 0.6 | Medium | Consider in-app nudge |
| 0.6 – 0.8 | High | Trigger re-engagement email |
| 0.8 – 1.0 | Critical | Manual outreach or offer |

### Output stored in `predictions`

```json
{
  "churn_score": 0.72,
  "days_since_last_session": 14,
  "total_sessions": 8,
  "avg_session_duration_min": 4.2,
  "risk_level": "high",
  "signal": "inactivity"
}
```

---

## Growth Model: Cohort-Based Retention Curves

### Purpose

Retention curves show how well the product retains users over time, segmented by the week they first signed up (acquisition cohort). A flattening curve (retention stabilising above 0%) is the goal — it indicates a product has found a sticky use case.

### Computation

Uses the cohort retention SQL from the V1 window functions section above. Each cohort's retention at weeks 1, 2, 4, and 8 is stored as a `predictions` row.

```json
{
  "cohort_week": "2026-01-06",
  "cohort_size": 42,
  "retention": {
    "week_1": 0.71,
    "week_2": 0.55,
    "week_4": 0.38,
    "week_8": 0.26
  },
  "curve_shape": "typical_decay"
}
```

### `curve_shape` classification

| Value | Meaning |
|---|---|
| `"healthy_flatten"` | Retention stabilises ≥ 20% by week 8 — strong product-market fit signal |
| `"typical_decay"` | Normal decay curve — retention falls but stabilises |
| `"steep_decay"` | Retention drops below 10% by week 4 — engagement problem |
| `"insufficient_data"` | Cohort too recent or too small to classify |

This field enables quick scanning of cohort health without reading the full retention numbers.

---

## Scheduled Execution

The `run-predictions` Edge Function is triggered on a schedule defined in `supabase/functions/run-predictions/index.ts`. Recommended cadence:

| Model | Frequency | Rationale |
|---|---|---|
| `churn_v1` | Daily at 02:00 UTC | Inactivity scores only meaningful at day granularity |
| `engagement_trend_v1` | Daily at 02:30 UTC | 7-day moving average — no point running more frequently |
| `revenue_forecast_v1` | Weekly on Monday 03:00 UTC | Forecasts don't change meaningfully day-to-day |
| Cohort retention | Weekly on Monday 03:30 UTC | Cohort data only gains signal weekly |
