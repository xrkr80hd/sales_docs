-- Cloneable consultant business cards with private drafts and button-based publishing.
create table if not exists public.consultant_profiles (
  consultant_slug text primary key check (consultant_slug ~ '^[a-z0-9-]+$'),
  display_name text not null default '',
  title text not null default 'Sales Consultant',
  dealership text not null default 'Walker Automotive',
  location text not null default '',
  phone text not null default '',
  email text not null default '',
  profile_image_url text not null default '',
  sales_quote text not null default '',
  calling_card_image_url text not null default '',
  inventory_url text not null default 'https://www.walkerautomotive.com/',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consultant_profiles
  add column if not exists owner_id uuid unique references auth.users(id) on delete cascade,
  add column if not exists draft_content jsonb not null default '{}'::jsonb,
  add column if not exists published_content jsonb not null default '{}'::jsonb,
  add column if not exists published_at timestamptz;

alter table public.consultant_profiles enable row level security;
revoke all on public.consultant_profiles from anon, authenticated;
grant select (consultant_slug, published_content, published_at, is_published) on public.consultant_profiles to anon;
grant select, insert, update, delete on public.consultant_profiles to authenticated;

create policy "Public reads published consultant cards"
on public.consultant_profiles for select to anon
using (is_published = true and published_at is not null);

create policy "Owners read own consultant card"
on public.consultant_profiles for select to authenticated
using (owner_id = (select auth.uid()) or (is_published = true and published_at is not null));

create policy "Owners create own consultant card"
on public.consultant_profiles for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "Owners update own consultant card"
on public.consultant_profiles for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners delete own consultant card"
on public.consultant_profiles for delete to authenticated
using (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consultant-media', 'consultant-media', true, 104857600,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Consultants upload own media"
on storage.objects for insert to authenticated
with check (bucket_id = 'consultant-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Consultants update own media"
on storage.objects for update to authenticated
using (bucket_id = 'consultant-media' and owner = (select auth.uid()))
with check (bucket_id = 'consultant-media' and owner = (select auth.uid()) and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Consultants delete own media"
on storage.objects for delete to authenticated
using (bucket_id = 'consultant-media' and owner = (select auth.uid()));

create or replace function public.create_consultant_card_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  base_slug text;
  new_slug text;
  template_content jsonb;
begin
  select coalesce(p.published_content, '{}'::jsonb) into template_content
  from public.consultant_profiles p where p.consultant_slug = 'trav';

  if lower(coalesce(new.email, '')) = 'xrkr80hd@gmail.com' then
    update public.consultant_profiles set owner_id = new.id, updated_at = now()
    where consultant_slug = 'trav' and owner_id is null;
    update public.consultant_users set auth_user_id = new.id, role = 'admin', is_enabled = true, updated_at = now()
    where consultant_slug = 'trav';
    return new;
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(split_part(coalesce(new.email, 'consultant'), '@', 1)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'consultant'; end if;
  new_slug := base_slug;
  if exists(select 1 from public.consultant_profiles where consultant_slug = new_slug) then
    new_slug := base_slug || '-' || left(replace(new.id::text, '-', ''), 6);
  end if;

  insert into public.consultant_profiles
    (consultant_slug, owner_id, display_name, title, dealership, location, phone, email,
     profile_image_url, sales_quote, calling_card_image_url, inventory_url, is_published,
     draft_content, published_content, published_at)
  values
    (new_slug, new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'New Consultant'), '@', 1)),
     'Sales Consultant', 'Walker Automotive', '', '', coalesce(new.email, ''), '', '', '',
     'https://www.walkerautomotive.com/', false, template_content, '{}'::jsonb, null);
  insert into public.consultant_users (auth_user_id, consultant_slug, email, display_name, role, is_enabled)
  values (new.id, new_slug, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'display_name', 'New Consultant'), 'consultant', true);
  return new;
end;
$$;

revoke all on function public.create_consultant_card_for_new_user() from public, anon, authenticated;
create trigger create_consultant_card_after_signup after insert on auth.users
for each row execute function public.create_consultant_card_for_new_user();
