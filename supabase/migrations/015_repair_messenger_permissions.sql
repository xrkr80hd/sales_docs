-- Repair owner authority and initial NXTDox Messenger access.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.id = auth.uid()
      and (p.role = 'admin' or lower(u.email) = 'xrkr80hd@gmail.com')
  );
$$;

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

  insert into public.profiles (id, role, display_name, card_enabled)
  values (
    new.id,
    assigned_role,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
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

update public.profiles
set role = 'admin', card_enabled = true
where id in (
  select id from auth.users where lower(email) = 'xrkr80hd@gmail.com'
);

with target_users as (
  select p.id
  from public.profiles p
  left join auth.users u on u.id = p.id
  where lower(coalesce(u.email, '')) = 'xrkr80hd@gmail.com'
     or lower(coalesce(u.email, '')) like '%goff%'
     or lower(coalesce(p.display_name, '')) like '%donald%goff%'
), target_org as (
  select id
  from public.organizations
  order by case when slug = 'walker-toyota' then 0 else 1 end, name
  limit 1
)
insert into public.organization_memberships (
  organization_id,
  user_id,
  chat_enabled,
  can_dm,
  can_org_chat
)
select target_org.id, target_users.id, true, true, true
from target_users
cross join target_org
on conflict (user_id) do update
set chat_enabled = true,
    can_dm = true,
    can_org_chat = true,
    updated_at = now();