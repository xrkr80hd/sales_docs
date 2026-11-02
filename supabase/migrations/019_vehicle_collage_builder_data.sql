alter table public.consultant_vehicles
  add column if not exists builder_data jsonb;
