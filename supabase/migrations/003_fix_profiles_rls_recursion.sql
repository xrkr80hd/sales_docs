-- ============================================================
-- Fix: infinite recursion in profiles RLS policies
-- The admin policies query profiles to check role, which
-- triggers the same RLS policies again → infinite loop.
-- Fix: use a SECURITY DEFINER function that bypasses RLS.
-- ============================================================

-- 1. Create a helper function that checks admin status WITHOUT RLS
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2. Drop the old recursive policies
drop policy if exists "Admins read all profiles" on public.profiles;
drop policy if exists "Admins update profiles" on public.profiles;
drop policy if exists "Admins insert profiles" on public.profiles;

-- 3. Recreate policies using the non-recursive is_admin() function
create policy "Admins read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admins update profiles"
  on public.profiles for update
  using (public.is_admin());

create policy "Admins insert profiles"
  on public.profiles for insert
  with check (public.is_admin());

-- 4. Also fix invites policies (same recursion risk)
drop policy if exists "Admins manage invites" on public.invites;

create policy "Admins manage invites"
  on public.invites for all
  using (public.is_admin());
