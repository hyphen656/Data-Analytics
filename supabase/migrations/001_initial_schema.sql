-- Users table: mirrors Clerk user records
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


-- Sessions table: one row per user session
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


-- Events table: append-only fact table
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


-- Funnels table: global funnel definitions
create table public.funnels (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  steps       jsonb       not null,
  created_at  timestamptz not null default now()
);

alter table public.funnels enable row level security;

create policy "funnels: authenticated read"
  on public.funnels for select
  using (auth.jwt() ->> 'sub' is not null);


-- Predictions table: model outputs
create table public.predictions (
  id             uuid        primary key default gen_random_uuid(),
  clerk_user_id  text        not null references public.users(clerk_user_id) on delete cascade,
  model_type     text        not null,
  prediction     jsonb       not null,
  created_at     timestamptz not null default now()
);

create index predictions_clerk_user_id_idx   on public.predictions (clerk_user_id);
create index predictions_user_model_time_idx on public.predictions (clerk_user_id, model_type, created_at desc);

alter table public.predictions enable row level security;

create policy "predictions: own rows only"
  on public.predictions for all
  using (clerk_user_id = auth.jwt() ->> 'sub');
