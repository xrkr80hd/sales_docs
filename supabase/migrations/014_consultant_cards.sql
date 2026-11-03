-- ============================================================
-- Migration 014: Consultant Cards & Profile Media Database
-- ============================================================

-- 1. Ensure xrkr80hd@gmail.com is an admin and profiles has card_enabled flag
alter table public.profiles
  add column if not exists card_enabled boolean not null default false;

-- Update xrkr80hd to admin with card_enabled = true
update public.profiles
set role = 'admin', card_enabled = true
where id in (
  select id from auth.users where lower(email) = 'xrkr80hd@gmail.com'
);

-- Ensure xrkr80hd@gmail.com has total Messenger permissions
insert into public.organization_memberships (organization_id, user_id, chat_enabled, can_dm, can_org_chat)
select 
  org.id,
  u.id,
  true,
  true,
  true
from auth.users u
cross join (select id from public.organizations limit 1) org
where lower(u.email) = 'xrkr80hd@gmail.com'
on conflict (user_id) do update
set chat_enabled = true, can_dm = true, can_org_chat = true;

-- Enable card and messenger for Donald Goff
update public.profiles
set card_enabled = true
where id in (
  select id from auth.users where lower(email) like '%donald%goff%' or lower(email) like '%goff%'
) or lower(display_name) like '%donald%goff%';

insert into public.organization_memberships (organization_id, user_id, chat_enabled, can_dm, can_org_chat)
select 
  org.id,
  p.id,
  true,
  true,
  true
from public.profiles p
cross join (select id from public.organizations limit 1) org
where lower(p.display_name) like '%donald%goff%'
   or p.id in (select id from auth.users where lower(email) like '%donald%goff%' or lower(email) like '%goff%')
on conflict (user_id) do update
set chat_enabled = true, can_dm = true, can_org_chat = true;

-- 2. Consultant Cards main table
create table if not exists public.consultant_cards (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null unique references public.profiles(id) on delete cascade,
  slug                    text not null unique,
  is_published            boolean not null default false,
  published_at            timestamptz,
  display_name            text not null default '',
  job_title               text not null default 'Sales Consultant',
  dealership              text not null default 'Walker Automotive',
  location                text not null default 'Alexandria, Louisiana',
  phone                   text not null default '',
  email                   text not null default '',
  profile_image_url       text not null default '',
  calling_card_image_url  text not null default '',
  logo_url                text not null default '/branding/nxtdox-by-eben.png',
  language_label          text not null default 'EN · ES',
  primary_phrase          text not null default '',
  sales_quote             text not null default '',
  bio                     text not null default '',
  inventory_url           text not null default 'https://www.walkerautomotive.com/',
  inventory_button_label  text not null default 'Browse Walker Inventory',
  call_label              text not null default 'Call',
  text_label              text not null default 'Text',
  email_label             text not null default 'Email',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- 3. Reviews table (capped per card, e.g. max 10)
create table if not exists public.consultant_reviews (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references public.consultant_cards(id) on delete cascade,
  reviewer_name text not null default '',
  image_url     text not null default '',
  rating        int not null default 5,
  is_long       boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- 4. Vehicles table
create table if not exists public.consultant_vehicles (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references public.consultant_cards(id) on delete cascade,
  title         text not null default '',
  description   text not null default '',
  url           text not null default '',
  image_url     text not null default '',
  vin           text not null default '',
  stock         text not null default '',
  price         text not null default '',
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- 5. Walk-around videos table (1-2 videos)
create table if not exists public.consultant_videos (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references public.consultant_cards(id) on delete cascade,
  title         text not null default '',
  description   text not null default '',
  video_url     text not null default '',
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- 6. Sold gallery table
create table if not exists public.consultant_sold_gallery (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references public.consultant_cards(id) on delete cascade,
  title         text not null default '',
  description   text not null default '',
  image_url     text not null default '',
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- 7. Social links table
create table if not exists public.consultant_social_links (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references public.consultant_cards(id) on delete cascade,
  title         text not null default '',
  url           text not null default '',
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- Indexes
create index if not exists idx_consultant_cards_slug on public.consultant_cards(slug);
create index if not exists idx_consultant_cards_user on public.consultant_cards(user_id);
create index if not exists idx_consultant_reviews_card on public.consultant_reviews(card_id, sort_order);
create index if not exists idx_consultant_vehicles_card on public.consultant_vehicles(card_id, sort_order);
create index if not exists idx_consultant_videos_card on public.consultant_videos(card_id, sort_order);

-- Give every profile an isolated media bucket. Existing shared-bucket URLs
-- remain valid; new uploads are stored in the owner's dedicated bucket.
create or replace function public.ensure_consultant_media_bucket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
  values (
    'consultant-media-' || new.id::text,
    'consultant-media-' || new.id::text,
    true,
    104857600,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ]
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_profile_create_media_bucket on public.profiles;
create trigger on_profile_create_media_bucket
  after insert on public.profiles
  for each row execute function public.ensure_consultant_media_bucket();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
select
  'consultant-media-' || id::text,
  'consultant-media-' || id::text,
  true,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
from public.profiles
on conflict (id) do nothing;

-- Enable RLS
alter table public.consultant_cards enable row level security;
alter table public.consultant_reviews enable row level security;
alter table public.consultant_vehicles enable row level security;
alter table public.consultant_videos enable row level security;
alter table public.consultant_sold_gallery enable row level security;
alter table public.consultant_social_links enable row level security;

-- Policies for public.consultant_cards
-- Public can read published cards
create policy "Public can read published cards"
  on public.consultant_cards for select
  using (is_published = true);

-- Users can read their own card (even draft)
create policy "Users read own card"
  on public.consultant_cards for select
  using (user_id = auth.uid());

-- Admins can read all cards
create policy "Admins read all cards"
  on public.consultant_cards for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Users can insert/update their own card if card_enabled is true or admin
create policy "Permitted users insert own card"
  on public.consultant_cards for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and (p.card_enabled = true or p.role = 'admin'))
  );

create policy "Permitted users update own card"
  on public.consultant_cards for update
  using (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and (p.card_enabled = true or p.role = 'admin'))
  );

-- Admins manage all cards
create policy "Admins update all cards"
  on public.consultant_cards for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Child item RLS
create policy "Public can read published card reviews"
  on public.consultant_reviews for select
  using (exists (select 1 from public.consultant_cards c where c.id = card_id and c.is_published = true));

create policy "Card owners manage own reviews"
  on public.consultant_reviews for all
  using (exists (select 1 from public.consultant_cards c where c.id = card_id and c.user_id = auth.uid()));

create policy "Admins manage all reviews"
  on public.consultant_reviews for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Vehicles policies
create policy "Public can read published card vehicles"
  on public.consultant_vehicles for select
  using (exists (select 1 from public.consultant_cards c where c.id = card_id and c.is_published = true));

create policy "Card owners manage own vehicles"
  on public.consultant_vehicles for all
  using (exists (select 1 from public.consultant_cards c where c.id = card_id and c.user_id = auth.uid()));

create policy "Admins manage all vehicles"
  on public.consultant_vehicles for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Videos policies
create policy "Public can read published card videos"
  on public.consultant_videos for select
  using (exists (select 1 from public.consultant_cards c where c.id = card_id and c.is_published = true));

create policy "Card owners manage own videos"
  on public.consultant_videos for all
  using (exists (select 1 from public.consultant_cards c where c.id = card_id and c.user_id = auth.uid()));

create policy "Admins manage all videos"
  on public.consultant_videos for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Sold gallery policies
create policy "Public can read published card sold gallery"
  on public.consultant_sold_gallery for select
  using (exists (select 1 from public.consultant_cards c where c.id = card_id and c.is_published = true));

create policy "Card owners manage own sold gallery"
  on public.consultant_sold_gallery for all
  using (exists (select 1 from public.consultant_cards c where c.id = card_id and c.user_id = auth.uid()));

create policy "Admins manage all sold gallery"
  on public.consultant_sold_gallery for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Social links policies
create policy "Public can read published card social links"
  on public.consultant_social_links for select
  using (exists (select 1 from public.consultant_cards c where c.id = card_id and c.is_published = true));

create policy "Card owners manage own social links"
  on public.consultant_social_links for all
  using (exists (select 1 from public.consultant_cards c where c.id = card_id and c.user_id = auth.uid()));

create policy "Admins manage all social links"
  on public.consultant_social_links for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
