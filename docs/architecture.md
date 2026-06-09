# Architecture

## System Overview

This dashboard is a full-stack analytics platform. All user-facing analytics data flows through a single authenticated path: the user proves their identity through Clerk, which issues a JWT that gates every downstream Supabase query. There is no public data surface — every route, every query, every Edge Function call requires a valid Clerk session.

```
Browser
  └── Clerk (auth)
        └── Next.js App Router (server + client components)
              ├── Supabase Postgres (data, RLS enforced via Clerk JWT)
              ├── Supabase Realtime (live event streams)
              └── Supabase Edge Functions (event ingestion, predictions)
```

## Data Flow

### Read path (dashboard views)

1. User visits any dashboard route
2. Next.js middleware (`middleware.ts`) calls Clerk's `authMiddleware` — unauthenticated requests redirect to `/sign-in`
3. Server component calls `auth()` from `@clerk/nextjs/server` to retrieve the session
4. Server component instantiates a Supabase client with the Clerk JWT injected as the `Authorization: Bearer <token>` header
5. Supabase evaluates the JWT, extracts `clerk_user_id` from the claims, and applies RLS policies
6. Query results are returned only for rows where `clerk_user_id` matches the authenticated user (or admin role overrides)

### Write path (event ingestion)

1. Client-side SDK or server action sends a POST to the Edge Function `/functions/v1/ingest-event`
2. Edge Function validates the Clerk JWT in the `Authorization` header
3. Edge Function inserts a row into the `events` table using the service role key (server-side only — never exposed to the browser)
4. Supabase Realtime broadcasts the insert to any subscribed clients

### Prediction path

1. A scheduled Edge Function (or on-demand trigger) queries recent `events` and `sessions` for a user
2. Runs SQL window functions (V1) or calls an external ML endpoint (V2) to produce a prediction record
3. Inserts result into the `predictions` table
4. Dashboard prediction panel reads from `predictions` on next load

---

## Frontend Architecture

### App Router layout

```
app/
  layout.tsx              # Root layout: ClerkProvider, global styles
  (auth)/
    sign-in/page.tsx
    sign-up/page.tsx
  (dashboard)/
    layout.tsx            # Dashboard shell: sidebar, top nav, auth guard
    page.tsx              # Overview (redirects to /overview)
    overview/page.tsx
    behaviour/page.tsx
    trends/page.tsx
    predictions/page.tsx
```

### Dashboard shell

The `(dashboard)/layout.tsx` wraps all analytics pages with:
- A persistent sidebar for navigation between the four views
- A top bar showing the current user (Clerk `<UserButton />`) and date range selector
- A breadcrumb trail for deep pages

### Component structure

```
components/
  ui/                     # Primitive, reusable components (buttons, cards, badges)
  charts/                 # Chart wrappers (thin abstractions over the charting library)
  dashboard/              # Composite components specific to dashboard views
    MetricCard.tsx
    FunnelChart.tsx
    TrendLine.tsx
    PredictionBadge.tsx
  layout/
    Sidebar.tsx
    TopBar.tsx
```

Components are server components by default. Client components (`"use client"`) are only used where interactivity or browser APIs are required (chart animations, realtime subscriptions, date range pickers).

### Data fetching pattern

- **Server components**: call Supabase directly using the server-side client (Clerk JWT injected server-side); no API route needed
- **Client components with live data**: subscribe to Supabase Realtime channels; initial data passed as props from the server component parent
- **Mutations**: Next.js Server Actions, which re-validate the relevant cache tags on success

---

## Backend Architecture

### Supabase tables

See @docs/data-model.md for full schema. Summary:

| Table | Purpose |
|---|---|
| `users` | Mirrors Clerk user records; source of truth for plan/metadata |
| `sessions` | One row per user session; duration and device context |
| `events` | Append-only event log; the core fact table |
| `funnels` | Funnel definitions (name + ordered steps) |
| `predictions` | Model outputs keyed to user and model type |

### Edge Functions

All Edge Functions run on Deno and live in `supabase/functions/`.

**`ingest-event`**
- Accepts POST with `{ event_type, properties }` body
- Validates Clerk JWT
- Writes to `events` table
- Designed to handle high write volume; no joins, no reads

**`run-predictions`**
- Triggered on a schedule (cron) or via webhook
- Queries recent `events` and `sessions` per user
- Executes SQL window functions for V1 predictions
- Writes results to `predictions`

### Realtime subscriptions

The dashboard subscribes to the `events` table INSERT channel for the authenticated user's `clerk_user_id`. New events flow into the live activity feed on the Overview page without a page reload.

RLS applies to Realtime channels the same way it applies to database queries — a user can only subscribe to their own data.

### Row Level Security

Every table has RLS enabled. The standard policy pattern is:

```sql
-- Users can only read/write their own rows
create policy "users: own rows only"
  on public.events
  for all
  using (clerk_user_id = auth.jwt() ->> 'sub');
```

The Clerk JWT's `sub` claim is the `clerk_user_id`. Supabase is configured to trust Clerk as a JWT provider via the JWKS endpoint.

---

## Prediction and Trend Layer

### V1: SQL window functions

All trend calculations in V1 are pure SQL, executed at query time in server components:

- **7-day moving average**: `AVG(metric) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`
- **Week-over-week growth**: compare current period aggregate vs previous period using `LAG()`
- **Funnel drop-off**: `COUNT(DISTINCT clerk_user_id)` at each step, divided by step 1 count
- **Churn signal**: days since last session, scored against a threshold

This approach has no infrastructure dependencies beyond Postgres and is fast enough for dashboards serving a single authenticated user's data.

### V2: Time-series forecasting (planned)

The `run-predictions` Edge Function will be extended to call an external forecasting API (e.g., a Python microservice or a third-party time-series API). The `predictions` table schema is designed to store arbitrary JSON payloads so the model output format can change without a schema migration.

### Design principle

The prediction layer is intentionally separated from the display layer. Dashboard components read from the `predictions` table — they do not compute predictions themselves. This means the computation backend can be swapped (SQL → ML model) without changing any frontend code.
