-- 007 — Add sales_manager role

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'user', 'fni', 'sales_manager'));

alter table public.invites drop constraint if exists invites_role_check;
alter table public.invites add constraint invites_role_check check (role in ('admin', 'user', 'fni', 'sales_manager'));

alter table public.notifications drop constraint if exists notifications_recipient_role_check;
alter table public.notifications add constraint notifications_recipient_role_check check (recipient_role in ('admin', 'user', 'fni', 'sales_manager'));

create policy "Sales manager read fni-ready deals"
  on public.deals for select
  using (fni_ready = true and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'sales_manager'
  ));
