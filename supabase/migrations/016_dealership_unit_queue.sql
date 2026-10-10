-- Phase 1: one consultant per active unit/deal, dealership-specific queue.
-- Apply only after assigning authorized members to dealership_access.
create table if not exists public.dealership_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  dealership_code text not null check (dealership_code ~ '^[A-Z0-9_-]{2,32}$'),
  role text not null check (role in ('consultant','sales_manager','fni','admin')),
  primary key (user_id, dealership_code, role)
);
alter table public.dealership_access enable row level security;
create policy "Read own store assignments" on public.dealership_access
  for select using (user_id = auth.uid());
-- Assignment writes are server/admin-only. Do not expose service-role key to browsers.

create table if not exists public.dealership_unit_queue (
  id uuid primary key default gen_random_uuid(),
  dealership_code text not null check (dealership_code ~ '^[A-Z0-9_-]{2,32}$'),
  vehicle_vin text not null check (vehicle_vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  consultant_id uuid not null references auth.users(id),
  deal_id uuid references public.deals(id),
  status text not null default 'waiting' check (status in ('waiting','with_manager','fni_prep','ready_for_signing','complete','cancelled')),
  queued_at timestamptz not null default now(),
  stage_updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);
-- Exactly one active queue record per VIN in a dealership.
create unique index if not exists uq_active_unit_per_dealership
  on public.dealership_unit_queue(dealership_code, vehicle_vin)
  where status not in ('complete','cancelled');
create index if not exists ix_unit_queue_store_wait on public.dealership_unit_queue(dealership_code, queued_at)
  where status not in ('complete','cancelled');
alter table public.dealership_unit_queue enable row level security;
create policy "Read queue by authorized dealership" on public.dealership_unit_queue
  for select using (exists (
    select 1 from public.dealership_access a
    where a.user_id = auth.uid() and a.dealership_code = dealership_unit_queue.dealership_code
  ));
-- Queue writes are performed only by authenticated, role-verified server endpoints.
