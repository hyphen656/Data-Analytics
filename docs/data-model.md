# Data Model

All tables live in the `public` schema of the Supabase Postgres database. Every table has RLS enabled. The `clerk_user_id` column (type `text`) is the foreign key that ties every row back to an authenticated Clerk user — it maps to the `sub` claim of the Clerk JWT.

---

## Table: `users`

Mirrors Clerk's user record. Populated via a Clerk webhook on `user.created` and updated on `user.updated`. This is the source of truth for plan tier and user-level metadata.

```sql
create table public.users (
  clerk_user_id  text        primary key,
  email          text        not null unique,
  created_at     timestamptz not null default now(),
  plan           text        not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  metadata       jsonb       not null default '{}'
);

alter table public.users enable row level security;

create policy "users: read own row"
  on public.users for select
  using (clerk_user_id = auth.jwt() ->> 'sub');

create policy "users: update own row"
  on public.users for update
  using (clerk_user_id = auth.jwt() ->> 'sub');
```

### Column notes

| Column | Notes |
|---|---|
| `clerk_user_id` | Clerk's user ID (`user_xxxxxxxx`). Primary key — no surrogate UUID needed. |
| `email` | Synced from Clerk. Not used for auth — Clerk owns auth. |
| `plan` | Constrained to known tiers. Controls feature access in RLS and UI. |
| `metadata` | Freeform JSON for extensible user properties (e.g. company, role, onboarding flags). |

---

## Table: `sessions`

One row per user session. A session begins when the user loads the app and ends when they close it or after a configurable inactivity timeout. Used to compute session duration, DAU/WAU/MAU, and churn signals.

```sql
create table public.sessions (
  id             uuid        primary key default gen_random_uuid(),
  clerk_user_id  text        not null references public.users(clerk_user_id) on delete cascade,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  device         text,
  country        text
);

create index sessions_clerk_user_id_idx on public.sessions (clerk_user_id);
create index sessions_started_at_idx    on public.sessions (started_at);

alter table public.sessions enable row level security;

create policy "sessions: own rows only"
  on public.sessions for all
  using (clerk_user_id = auth.jwt() ->> 'sub');
```

### Column notes

| Column | Notes |
|---|---|
| `id` | UUID primary key. |
| `clerk_user_id` | FK to `users`. Cascades on user deletion. |
| `started_at` | When the session was opened. Indexed for time-range queries. |
| `ended_at` | Null while session is active. Duration = `ended_at - started_at`. |
| `device` | Free text: `"desktop"`, `"mobile"`, `"tablet"`. Derived from user-agent on ingestion. |
| `country` | ISO 3166-1 alpha-2 country code. Derived from IP on ingestion via Edge Function. |

---

## Table: `events`

The core append-only fact table. Every meaningful user action produces one row. High write volume — no updates or deletes. Powers funnel analysis, engagement metrics, and is the input to prediction models.

```sql
create table public.events (
  id             uuid        primary key default gen_random_uuid(),
  clerk_user_id  text        not null references public.users(clerk_user_id) on delete cascade,
  event_type     text        not null,
  properties     jsonb       not null default '{}',
  created_at     timestamptz not null default now()
);

create index events_clerk_user_id_idx  on public.events (clerk_user_id);
create index events_event_type_idx     on public.events (event_type);
create index events_created_at_idx     on public.events (created_at desc);
create index events_user_type_time_idx on public.events (clerk_user_id, event_type, created_at desc);

alter table public.events enable row level security;

create policy "events: own rows only"
  on public.events for all
  using (clerk_user_id = auth.jwt() ->> 'sub');
```

### Column notes

| Column | Notes |
|---|---|
| `id` | UUID primary key. |
| `clerk_user_id` | FK to `users`. Cascades on user deletion. |
| `event_type` | From the event taxonomy in @docs/analytics-spec.md. Indexed for filtering. |
| `properties` | Arbitrary JSON payload. Schema varies by event type — see analytics-spec for per-event property shapes. |
| `created_at` | Event timestamp. Descending index — most dashboard queries read recent events first. |

### Composite index note

`events_user_type_time_idx` covers the most common query pattern: "give me all `page_view` events for user X in the last 30 days." Postgres will use this index for both filtering and ordering.

---

## Table: `funnels`

Stores funnel definitions. A funnel is an ordered list of event types that represents a conversion path (e.g. sign_up → question_asked → payment_made). Funnel analysis queries the `events` table to compute how many users completed each step.

```sql
create table public.funnels (
  id          uuid  primary key default gen_random_uuid(),
  name        text  not null,
  steps       jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.funnels enable row level security;

create policy "funnels: authenticated read"
  on public.funnels for select
  using (auth.jwt() ->> 'sub' is not null);
```

### Column notes

| Column | Notes |
|---|---|
| `id` | UUID primary key. |
| `name` | Human-readable funnel name, e.g. `"Activation Funnel"`. |
| `steps` | JSON array of event type strings in order, e.g. `["sign_up", "question_asked", "payment_made"]`. |
| `created_at` | When the funnel was defined. |

### `steps` shape

```json
["sign_up", "question_asked", "payment_made"]
```

Funnel analysis SQL iterates over this array using `jsonb_array_elements_text()` and computes the count of distinct users who reached each step.

### RLS note

Funnels are global definitions, not per-user data. Any authenticated user can read all funnels. Writes are restricted to admin roles (defined separately via a `role` claim in the JWT or a separate `admins` table).

---

## Table: `predictions`

Stores the output of prediction and trend models. One row per prediction run per user per model type. The `prediction` column holds the full model output as JSON — the schema is intentionally flexible to accommodate different model versions without migrations.

```sql
create table public.predictions (
  id             uuid        primary key default gen_random_uuid(),
  clerk_user_id  text        not null references public.users(clerk_user_id) on delete cascade,
  model_type     text        not null,
  prediction     jsonb       not null,
  created_at     timestamptz not null default now()
);

create index predictions_clerk_user_id_idx       on public.predictions (clerk_user_id);
create index predictions_user_model_time_idx     on public.predictions (clerk_user_id, model_type, created_at desc);

alter table public.predictions enable row level security;

create policy "predictions: own rows only"
  on public.predictions for all
  using (clerk_user_id = auth.jwt() ->> 'sub');
```

### Column notes

| Column | Notes |
|---|---|
| `id` | UUID primary key. |
| `clerk_user_id` | FK to `users`. Cascades on user deletion. |
| `model_type` | Identifier for the model that produced this row. E.g. `"churn_v1"`, `"revenue_forecast_v1"`, `"engagement_trend_v1"`. |
| `prediction` | Full model output as JSON. Shape varies by `model_type` — see @docs/prediction-models.md. |
| `created_at` | When the prediction was generated. |

### Example `prediction` payloads

**`churn_v1`**
```json
{
  "churn_score": 0.72,
  "days_since_last_session": 14,
  "risk_level": "high",
  "signal": "inactivity"
}
```

**`revenue_forecast_v1`**
```json
{
  "forecast_30d": 149.00,
  "forecast_90d": 420.00,
  "confidence": 0.81,
  "basis": "cohort_average"
}
```

**`engagement_trend_v1`**
```json
{
  "trend": "declining",
  "7d_avg_sessions": 1.2,
  "30d_avg_sessions": 3.4,
  "pct_change": -64.7
}
```

---

## Relationships

```
users (clerk_user_id)
  ├── sessions.clerk_user_id  (cascade delete)
  ├── events.clerk_user_id    (cascade delete)
  └── predictions.clerk_user_id (cascade delete)

funnels — no FK to users (global definitions)
```

Cascade deletes mean that removing a user from Clerk and deleting their `users` row will clean up all associated data automatically.
