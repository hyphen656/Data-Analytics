# Implementation Plan

Ordered list of every major task. Work top to bottom — each phase depends on the one before it. Check items off as they are completed.

---

## Phase 1: Auth Foundation

- [x] **Clerk setup and middleware**
  - Install `@clerk/nextjs`
  - Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local`
  - Create `middleware.ts` at root with `clerkMiddleware()` protecting all `(dashboard)` routes
  - Add `ClerkProvider` to `app/layout.tsx`
  - Create `app/(auth)/sign-in/[[...sign-in]]/page.tsx` and `sign-up/[[...sign-up]]/page.tsx`
  - Verify redirect flow: unauthenticated → `/sign-in` → dashboard

---

## Phase 2: Database Foundation

- [x] **Supabase project init and CLI setup**
  - Install Supabase CLI (`brew install supabase/tap/supabase`)
  - Run `supabase init` to generate `supabase/` directory
  - Run `supabase start` to boot local stack
  - Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`
  - Install `@supabase/supabase-js`
  - Create `lib/supabase/server.ts` (server-side client with Clerk JWT injection) and `lib/supabase/client.ts` (browser client)

- [ ] **Clerk–Supabase JWT integration**
  - In Supabase dashboard, add Clerk as a custom JWT provider using Clerk's JWKS URL
  - Configure the `authenticator` role in Supabase to accept Clerk JWTs
  - Update `lib/supabase/server.ts` to call `auth()` from Clerk and inject the session token as `Authorization: Bearer <token>`
  - Verify end-to-end: a signed-in Next.js server component can query Supabase and RLS resolves correctly

- [x] **Database schema and migrations**
  - Create `supabase/migrations/001_initial_schema.sql` with all five tables: `users`, `sessions`, `events`, `funnels`, `predictions`
  - Include all indexes from @docs/data-model.md
  - Run `supabase db push` to apply to local and remote
  - Verify tables and indexes appear in Supabase Studio

- [ ] **Row Level Security policies**
  - Add all RLS policies from @docs/data-model.md to the migration (or a new `002_rls.sql`)
  - Enable RLS on every table
  - Write a manual test: query each table as the anon role → expect 0 rows; query with a valid Clerk JWT → expect own rows only
  - Verify `funnels` is readable by any authenticated user

- [x] **Mock data seeding script**
  - Create `supabase/seed.sql` (or `scripts/seed.ts`) that inserts:
    - 5 users with different plan tiers and `created_at` dates spread over 6 months
    - ~10 sessions per user with realistic durations and device/country values
    - ~50 events per user across all event types with realistic property payloads
    - 3 funnel definitions covering the key conversion paths
    - Pre-computed prediction rows for each user and all four model types
  - Run with `supabase db reset` (applies migrations + seed)

---

## Phase 3: Dashboard Shell

- [ ] **Dashboard layout with sidebar navigation**
  - Create `app/(dashboard)/layout.tsx` wrapping all dashboard pages
  - Build `components/layout/Sidebar.tsx` with links to Overview, User Behaviour, Trends, Predictions
  - Build `components/layout/TopBar.tsx` with `<UserButton />` from Clerk and a date range selector
  - Apply Tailwind layout: sidebar fixed on desktop, collapsible drawer on mobile
  - Add loading skeletons for the layout shell (avoid layout shift during data fetch)

---

## Phase 4: Dashboard Pages

- [ ] **Overview page with mock charts**
  - Create `app/(dashboard)/overview/page.tsx` as a server component
  - Fetch DAU/WAU/MAU from Supabase (using seed data)
  - Build `components/dashboard/MetricCard.tsx` for the stat tiles with delta badges
  - Add a live event feed client component subscribed to Supabase Realtime
  - Add top events bar chart using chosen charting library
  - Wire up date range selector to re-fetch with new window

- [ ] **User Behaviour page**
  - Create `app/(dashboard)/behaviour/page.tsx`
  - Session count and duration line chart
  - Events by type bar chart (grouped by day)
  - Funnel selector dropdown — fetch funnel definitions from `funnels` table, display step-by-step drop-off
  - Device and country breakdown charts
  - Filter controls: date range, device, country

- [ ] **Trends page**
  - Create `app/(dashboard)/trends/page.tsx`
  - DAU/WAU/MAU trend lines with 7-day moving average overlay (SQL window functions)
  - Revenue trend bar chart (monthly totals)
  - Cohort retention table (read from `predictions` table, `cohort_retention_v1` model type)
  - WoW event volume heatmap
  - New vs. returning user ratio line

- [ ] **Predictions page**
  - Create `app/(dashboard)/predictions/page.tsx`
  - Read all prediction rows for the current user from `predictions` table
  - Churn risk panel: score meter + risk level badge + signal description
  - Revenue forecast panel: 30d and 90d figures with confidence indicator
  - Engagement trend panel: trajectory badge (improving / stable / declining) + sparkline
  - Model freshness footer: last updated timestamp per model

---

## Phase 5: Backend

- [ ] **Event ingestion Edge Function**
  - Create `supabase/functions/ingest-event/index.ts`
  - Validate Clerk JWT from `Authorization` header
  - Accept `{ event_type, properties }` POST body
  - Write to `events` table using service role client
  - Return `201` on success, `400` on validation error, `401` on auth failure
  - Deploy with `supabase functions deploy ingest-event`

- [ ] **Realtime subscriptions for live data**
  - Create a `useRealtimeEvents` hook in `hooks/useRealtimeEvents.ts`
  - Subscribe to `events` table INSERT channel filtered by `clerk_user_id`
  - Manage connection lifecycle (subscribe on mount, unsubscribe on unmount)
  - Pipe new events into the Overview page live activity feed
  - Test that RLS prevents users from seeing each other's events via Realtime

---

## Phase 6: Deployment

- [ ] **Vercel deployment and env vars**
  - Connect GitHub repo to Vercel project
  - Set all environment variables in Vercel dashboard:
    - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
    - `CLERK_SECRET_KEY`
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed to browser)
  - Set `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/overview`
  - Trigger a production deploy and verify auth flow end-to-end
  - Check that Realtime subscriptions work in production (Supabase project must be on a plan that supports Realtime)
  - Verify Edge Functions are deployed to the Supabase project linked to the production env vars
