create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid primary key references public.profiles(id) on delete cascade,
  chat_enabled boolean not null default false,
  can_dm boolean not null default false,
  can_org_chat boolean not null default false,
  assigned_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.messenger_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('dm','organization')),
  title text,
  dm_key text unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_org_chat_per_org
  on public.messenger_conversations(organization_id) where kind = 'organization';

create table if not exists public.messenger_participants (
  conversation_id uuid not null references public.messenger_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messenger_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.messenger_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

insert into public.organizations(name, slug) values
  ('Walker Toyota', 'walker-toyota'),
  ('Walker CDJR', 'walker-cdjr')
on conflict (slug) do nothing;

insert into public.messenger_conversations(organization_id, kind, title)
select id, 'organization', name || ' Chat' from public.organizations
on conflict do nothing;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.messenger_conversations enable row level security;
alter table public.messenger_participants enable row level security;
alter table public.messenger_messages enable row level security;

create policy "authenticated organizations" on public.organizations for select to authenticated using (true);
create policy "own membership" on public.organization_memberships for select to authenticated using (user_id = auth.uid());
create policy "own conversations" on public.messenger_conversations for select to authenticated using (
  exists (select 1 from public.organization_memberships m where m.user_id = auth.uid() and m.organization_id = organization_id and m.chat_enabled)
);
create policy "own participants" on public.messenger_participants for select to authenticated using (user_id = auth.uid());
create policy "permitted messages" on public.messenger_messages for select to authenticated using (
  exists (select 1 from public.messenger_conversations c join public.organization_memberships m on m.organization_id=c.organization_id
    where c.id=conversation_id and m.user_id=auth.uid() and m.chat_enabled)
);

do $$ begin
  alter publication supabase_realtime add table public.messenger_messages;
exception when duplicate_object then null;
end $$;
