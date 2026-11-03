-- Migration 011: User settings table for cross-device settings persistence
-- Stores dealer info + consultant info per user, synced to server on save.

create table if not exists public.user_settings (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  dealer_info     jsonb not null default '{}'::jsonb,
  consultant_info jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- Users can read and write their own settings row
create policy "Users read own settings"
  on public.user_settings for select
  using (user_id = auth.uid());

create policy "Users insert own settings"
  on public.user_settings for insert
  with check (user_id = auth.uid());

create policy "Users update own settings"
  on public.user_settings for update
  using (user_id = auth.uid());

-- Admins can read all settings (for support/debug)
create policy "Admins read all settings"
  on public.user_settings for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
