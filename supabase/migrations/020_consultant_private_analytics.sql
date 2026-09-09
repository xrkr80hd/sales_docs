-- Private, per-consultant engagement analytics.
-- Raw IP addresses and user-agent strings are never stored.
create table if not exists public.consultant_analytics_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.consultant_cards(id) on delete cascade,
  event_type text not null check (event_type in (
    'card_view',
    'video_view',
    'vehicle_view',
    'call_click',
    'text_click',
    'email_click',
    'listing_click'
  )),
  item_id text not null default '',
  visitor_hash text not null,
  event_day date not null default current_date,
  created_at timestamptz not null default now(),
  unique (card_id, event_type, item_id, visitor_hash, event_day)
);

create index if not exists idx_consultant_analytics_card_day
  on public.consultant_analytics_events(card_id, event_day desc);

create index if not exists idx_consultant_analytics_item
  on public.consultant_analytics_events(card_id, event_type, item_id);

alter table public.consultant_analytics_events enable row level security;

-- Analytics are intentionally unavailable through the browser Data API.
-- Public writes and private reads go through authenticated server routes.
revoke all on table public.consultant_analytics_events from anon, authenticated;
