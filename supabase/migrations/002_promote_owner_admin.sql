-- ============================================================
-- Promote xrkr80hd@gmail.com to admin
-- Run this in the Supabase SQL Editor
-- ============================================================

update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'xrkr80hd@gmail.com'
);
