-- Messenger nicknames are organization-specific. Permanent usernames remain
-- attached to the NXTDox profile so chat identities can never be anonymous.

alter table public.profiles
  add column if not exists username text;

update public.profiles p
set username = split_part(lower(u.email), '@', 1)
from auth.users u
where u.id = p.id
  and coalesce(trim(p.username), '') = '';

alter table public.organization_memberships
  add column if not exists chat_nickname text;

alter table public.organization_memberships
  drop constraint if exists organization_memberships_chat_nickname_length;

alter table public.organization_memberships
  add constraint organization_memberships_chat_nickname_length
  check (chat_nickname is null or char_length(trim(chat_nickname)) between 1 and 32);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role text;
begin
  assigned_role := case
    when lower(new.email) = 'xrkr80hd@gmail.com' then 'admin'
    else coalesce(
      (
        select i.role
        from public.invites i
        where lower(i.email) = lower(new.email)
          and i.accepted_at is null
          and i.expires_at > now()
        order by i.created_at desc
        limit 1
      ),
      'user'
    )
  end;

  insert into public.profiles (id, role, display_name, username, card_enabled)
  values (
    new.id,
    assigned_role,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    split_part(lower(new.email), '@', 1),
    lower(new.email) = 'xrkr80hd@gmail.com' or lower(new.email) like '%goff%'
  );

  update public.invites
  set accepted_at = now()
  where lower(email) = lower(new.email)
    and accepted_at is null;

  if lower(new.email) = 'xrkr80hd@gmail.com' or lower(new.email) like '%goff%' then
    insert into public.organization_memberships (
      organization_id,
      user_id,
      chat_enabled,
      can_dm,
      can_org_chat
    )
    select id, new.id, true, true, true
    from public.organizations
    order by case when slug = 'walker-automotive' then 0 else 1 end, name
    limit 1
    on conflict (user_id) do update
    set chat_enabled = true,
        can_dm = true,
        can_org_chat = true,
        updated_at = now();
  end if;

  return new;
end;
$$;
