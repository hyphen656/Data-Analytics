# Analytics Specification

## Metrics to Track

### Active Users

| Metric | Definition | Computation |
|---|---|---|
| DAU | Distinct users with at least one event on a given calendar day | `COUNT(DISTINCT clerk_user_id) WHERE date(created_at) = target_date` |
| WAU | Distinct users active in a rolling 7-day window | `COUNT(DISTINCT clerk_user_id) WHERE created_at >= now() - interval '7 days'` |
| MAU | Distinct users active in a rolling 30-day window | `COUNT(DISTINCT clerk_user_id) WHERE created_at >= now() - interval '30 days'` |
| DAU/MAU ratio | Stickiness proxy — higher is better | `DAU / MAU`, expressed as a percentage |

Active is defined as having produced at least one event row. A user who signs in but takes no action is not counted as active.

### Session Duration

| Metric | Definition |
|---|---|
| Average session duration | `AVG(ended_at - started_at)` across all completed sessions in the window |
| Median session duration | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ended_at - started_at)` |
| Sessions per user per day | `COUNT(sessions) / COUNT(DISTINCT clerk_user_id)` for a given day |

Sessions where `ended_at` is null (still active or not properly closed) are excluded from duration calculations.

### Funnel Drop-off

For each funnel defined in the `funnels` table:

1. Count distinct users who fired the first step's event (baseline)
2. For each subsequent step, count distinct users who fired that event **after** the previous step
3. Drop-off rate = `1 - (step_n_users / step_1_users)`
4. Conversion rate = `step_final_users / step_1_users`

Time window for funnel completion is configurable (default: 7 days from first step).

### Churn Signals

| Signal | Definition | Threshold |
|---|---|---|
| Inactive users | Users with no events in the last N days | Default: 14 days |
| Declining engagement | User's 7-day event count < 50% of their 30-day average | Computed per user |
| Single-session users | Users with exactly 1 session and no return | Identified after 7-day grace period |

Churn signals feed directly into the `predictions` table via the `churn_v1` model.

### Revenue per User

| Metric | Definition |
|---|---|
| ARPU (monthly) | Total `payment_made` event amounts in a month / MAU |
| LTV estimate | Average monthly ARPU × predicted retention months |
| Revenue by cohort | Group users by `created_at` month; sum `payment_made` properties per cohort |

Revenue amounts are stored in the `properties` JSON of `payment_made` events as `{ "amount": 49.00, "currency": "USD", "plan": "pro" }`.

---

## Event Taxonomy

All events are inserted into the `events` table with an `event_type` string and a `properties` JSON object. Below is the complete list of event types, their meaning, and the expected shape of their `properties` payload.

### `page_view`

Fired on every page navigation within the app.

```json
{
  "path": "/dashboard/overview",
  "referrer": "/",
  "duration_ms": 4200
}
```

| Property | Type | Notes |
|---|---|---|
| `path` | string | The Next.js route path |
| `referrer` | string | The previous path within the app (null for external referrals) |
| `duration_ms` | number | Time spent on the previous page before navigating away |

### `sign_up`

Fired once per user when their account is first created (via Clerk webhook).

```json
{
  "plan": "free",
  "source": "organic"
}
```

| Property | Type | Notes |
|---|---|---|
| `plan` | string | Initial plan assigned at sign-up |
| `source` | string | Acquisition channel if known (utm_source or `"organic"`) |

### `question_asked`

Fired when a user submits a question or query within the product.

```json
{
  "question_id": "q_abc123",
  "category": "analytics",
  "length_chars": 142
}
```

| Property | Type | Notes |
|---|---|---|
| `question_id` | string | Internal ID for the question record |
| `category` | string | Question category or topic area |
| `length_chars` | number | Character length of the question text |

### `answer_given`

Fired when the system returns an answer to a question.

```json
{
  "question_id": "q_abc123",
  "latency_ms": 820,
  "model": "v2",
  "satisfied": null
}
```

| Property | Type | Notes |
|---|---|---|
| `question_id` | string | Links back to the originating `question_asked` event |
| `latency_ms` | number | Time from question submission to answer display |
| `model` | string | Which model or pipeline version produced the answer |
| `satisfied` | boolean or null | User thumbs up/down if they rated the answer; null until rated |

### `payment_made`

Fired on successful payment processing.

```json
{
  "amount": 49.00,
  "currency": "USD",
  "plan": "pro",
  "interval": "monthly",
  "payment_id": "pay_xyz789"
}
```

| Property | Type | Notes |
|---|---|---|
| `amount` | number | Payment amount in the given currency |
| `currency` | string | ISO 4217 currency code |
| `plan` | string | Plan the payment is for |
| `interval` | string | `"monthly"` or `"annual"` |
| `payment_id` | string | External payment processor reference |

### `session_end`

Fired when a session is closed (tab close, inactivity timeout, or explicit sign-out).

```json
{
  "session_id": "uuid-of-session",
  "duration_ms": 183000,
  "events_in_session": 12,
  "reason": "inactivity"
}
```

| Property | Type | Notes |
|---|---|---|
| `session_id` | string | UUID of the corresponding `sessions` row |
| `duration_ms` | number | Total session length in milliseconds |
| `events_in_session` | number | Count of events fired during this session |
| `reason` | string | `"tab_close"`, `"inactivity"`, `"sign_out"` |

---

## Dashboard Views

### Overview

**Purpose**: High-level health snapshot. The first screen a user sees.

**Metrics displayed**:
- DAU / WAU / MAU with week-over-week delta badges
- DAU/MAU stickiness ratio
- Active sessions count (live, via Realtime)
- Top events by volume (last 24h)
- Live activity feed (last 20 events, updating in real time)

**Time range**: Default last 30 days; user-selectable (7d / 30d / 90d).

### User Behaviour

**Purpose**: Deep dive into how individual users and cohorts interact with the product.

**Metrics displayed**:
- Session count and average duration over time (line chart)
- Events by type (bar chart, grouped by day)
- Funnel analysis: select a funnel from a dropdown, view step-by-step drop-off
- Top pages by view count
- Device breakdown (pie chart: desktop / mobile / tablet)
- Country breakdown (top 10)

**Filters**: Date range, device type, country.

### Trends

**Purpose**: Surface directional signals — is the product growing, stagnating, or declining?

**Metrics displayed**:
- DAU/WAU/MAU trend lines (30-day rolling, with 7-day moving average overlay)
- Revenue trend (monthly `payment_made` totals, with MoM % change)
- Cohort retention table (weekly cohorts, showing % retained at weeks 1/2/4/8)
- Week-over-week event volume change (heatmap by event type)
- New vs. returning user ratio over time

**Computation**: All trend data uses SQL window functions — see @docs/prediction-models.md.

### Predictions

**Purpose**: Forward-looking signals to inform product and growth decisions.

**Panels displayed**:
- Churn risk list: users with a `churn_v1` score above 0.6, sorted by score descending
- Revenue forecast: 30-day and 90-day revenue projections with confidence interval
- Engagement trend: per-user engagement trajectory (improving / stable / declining)
- Model freshness indicator: timestamp of last `run-predictions` Edge Function execution

**Data source**: All panels read exclusively from the `predictions` table. No live computation at render time.
