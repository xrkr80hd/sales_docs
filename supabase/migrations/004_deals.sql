-- ============================================================
-- Walker Docs — Deals (server-side deal persistence)
-- Salesperson deal data stored as JSONB, auto-purged after finish.
-- Run via `supabase db push` or in the Supabase SQL Editor.
-- ============================================================

-- 1. Deals table — one row per active deal
create table if not exists public.deals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  workflow_data   jsonb not null default '{}'::jsonb,
  signatures      jsonb not null default '{}'::jsonb,
  status          text not null default 'open' check (status in ('open', 'finished')),
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for fast lookups by owner + status
create index if not exists idx_deals_user_status on public.deals (user_id, status);

-- Index for cleanup cron (find expired finished deals)
create index if not exists idx_deals_finished_at on public.deals (finished_at) where status = 'finished';

alter table public.deals enable row level security;

-- Users can read their own deals
create policy "Users read own deals"
  on public.deals for select
  using (auth.uid() = user_id);

-- Users can insert their own deals
create policy "Users insert own deals"
  on public.deals for insert
  with check (auth.uid() = user_id);

-- Users can update their own deals
create policy "Users update own deals"
  on public.deals for update
  using (auth.uid() = user_id);

-- Users can delete their own deals
create policy "Users delete own deals"
  on public.deals for delete
  using (auth.uid() = user_id);

-- Admins can read all deals
create policy "Admins read all deals"
  on public.deals for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can delete any deal
create policy "Admins delete all deals"
  on public.deals for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- 2. Auto-update `updated_at` on every write
create or replace function public.set_deals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_deals_updated_at on public.deals;
create trigger trg_deals_updated_at
  before update on public.deals
  for each row
  execute function public.set_deals_updated_at();

-- 3. Cleanup function — delete finished deals older than 8 hours
create or replace function public.cleanup_expired_deals()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.deals
  where status = 'finished'
    and finished_at < now() - interval '8 hours';
end;
$$;

-- 4. Schedule cleanup via pg_cron (runs every 30 minutes)
-- NOTE: pg_cron must be enabled in your Supabase project (Extensions → pg_cron).
-- If pg_cron is not yet enabled, enable it first, then run:
--
--   select cron.schedule(
--     'cleanup-expired-deals',
--     '*/30 * * * *',
--     $$ select public.cleanup_expired_deals(); $$
--   );
