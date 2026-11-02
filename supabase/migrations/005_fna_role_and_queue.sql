-- 005 — F&I Role, Deal Queue, Notifications (originally used 'fna' — corrected in 006)

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'user', 'fna'));

alter table public.invites drop constraint if exists invites_role_check;
alter table public.invites add constraint invites_role_check check (role in ('admin', 'user', 'fna'));

alter table public.deals
  add column if not exists fni_ready   boolean     not null default false,
  add column if not exists fni_sent_at timestamptz;

create index if not exists idx_deals_fni_queue
  on public.deals (fni_sent_at asc)
  where fni_ready = true and status = 'open';

create policy "FNA read fni-ready deals"
  on public.deals for select
  using (
    fni_ready = true
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'fna'
    )
  );

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  recipient_role text not null check (recipient_role in ('admin', 'user', 'fna')),
  deal_id        uuid references public.deals(id) on delete cascade,
  message        text not null,
  read           boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_notifications_role_unread
  on public.notifications (recipient_role, created_at desc)
  where read = false;

alter table public.notifications enable row level security;

create policy "Role users read own notifications"
  on public.notifications for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = recipient_role));

create policy "Role users update own notifications"
  on public.notifications for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = recipient_role));

create policy "Admins manage notifications"
  on public.notifications for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

alter publication supabase_realtime add table public.notifications;
