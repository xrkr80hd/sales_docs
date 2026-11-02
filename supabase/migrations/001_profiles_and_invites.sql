-- ============================================================
-- Walker Docs — Profiles & Invites
-- Run this once in the Supabase SQL Editor (or via `supabase db push`).
-- ============================================================

-- 1. Profiles — one row per auth user, stores role
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'user' check (role in ('admin', 'user')),
  display_name text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read all profiles
create policy "Admins read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can update any profile
create policy "Admins update profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admins can insert profiles (for invite acceptance)
create policy "Admins insert profiles"
  on public.profiles for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role bypasses RLS, so the API routes can always write.

-- 2. Invites — pending email invitations
create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  role        text not null default 'user' check (role in ('admin', 'user')),
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);

alter table public.invites enable row level security;

-- Admins can do everything with invites
create policy "Admins manage invites"
  on public.invites for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- 3. Auto-create profile on signup via trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce(
      (select i.role from public.invites i
       where lower(i.email) = lower(new.email)
         and i.accepted_at is null
         and i.expires_at > now()
       order by i.created_at desc limit 1),
      'user'
    ),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  -- Mark the invite as accepted
  update public.invites
  set accepted_at = now()
  where lower(email) = lower(new.email)
    and accepted_at is null;

  return new;
end;
$$;

-- Drop if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
