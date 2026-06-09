# Data Analytics Dashboard — CLAUDE.md

## Project

A data analytics dashboard tracking user behaviour, engagement funnels, revenue trends, and predictive models. Built for internal product analytics: understand who your users are, how they move through your product, where they drop off, and where they're headed.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Auth | Clerk |
| Database | Supabase (Postgres) |
| Realtime | Supabase Realtime |
| Edge Functions | Supabase Edge Functions (Deno) |
| Hosting | Vercel |

## Key Documentation

- @docs/architecture.md — System overview, data flow, frontend/backend structure
- @docs/data-model.md — All Supabase table schemas with column definitions
- @docs/analytics-spec.md — Metrics, event taxonomy, dashboard view specs
- @docs/prediction-models.md — V1 SQL models, V2 forecasting, churn scoring
- @docs/implementation-plan.md — Ordered checklist of every major task

## Auth Rules

Clerk is the **only** auth layer. There is no secondary auth system.

- Every Supabase query must pass the Clerk-issued JWT in the `Authorization` header
- Row Level Security (RLS) is enabled on **every** table — no exceptions
- `clerk_user_id` is the primary foreign key tying users to all data
- Never query Supabase as `service_role` from client-side code
- The Supabase client used in server components must be initialised with the Clerk JWT, not the anon key alone

## Commands

```bash
npm run dev          # Start Next.js dev server on localhost:3000
supabase start       # Start local Supabase stack (Docker)
supabase db push     # Apply pending migrations to remote Supabase project
supabase db reset    # Reset local DB and re-run all migrations + seed
```

## Conventions

- **TypeScript**: strict mode, `noImplicitAny: true` — never use `any`, use `unknown` and narrow
- **Commits**: Conventional Commits — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- **Secrets**: never hardcode API keys, JWTs, or connection strings — all secrets via `.env.local` and Vercel environment variables
- **Imports**: use `@/` path alias for all internal imports
- **Components**: co-locate component files with their page where possible; shared UI lives in `components/ui/`
- **Data fetching**: server components fetch directly from Supabase; client components use SWR or React Query for live/realtime data
- **RLS**: every new table must have RLS policies written before it is used in application code
