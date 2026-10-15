-- Preserve existing organization conversations as Consultant Chat.
alter table public.messenger_conversations add column channel text;
update public.messenger_conversations set channel='consultant' where kind='organization';
alter table public.messenger_conversations add constraint messenger_channel_kind check ((kind='dm' and channel is null) or (kind='organization' and channel is not null and channel in ('consultant','management')));
drop index public.one_org_chat_per_org;
create unique index one_org_channel on public.messenger_conversations(organization_id,channel) where kind='organization';
create index messenger_history on public.messenger_messages(conversation_id,id desc);
create index messenger_unread on public.messenger_messages(conversation_id,created_at) where deleted_at is null;
create index messenger_user_participation on public.messenger_participants(user_id,conversation_id);
create schema if not exists messenger_private;
revoke all on schema messenger_private from public;
grant usage on schema messenger_private to authenticated,service_role;

-- Reads current server-managed roles, not user-editable metadata or an email bypass.
create function messenger_private.organization_access(org uuid, management boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists (
 select 1 from public.profiles p join auth.users u on u.id=p.id
 left join public.organization_memberships m on m.user_id=p.id
 where p.id=auth.uid() and coalesce((u.raw_app_meta_data->>'must_change_password')::boolean,false)=false
 and exists(select 1 from public.organizations o where o.id=org)
 and not exists(select 1 from public.user_settings s join auth.users owner on owner.id=s.user_id
   where lower(owner.email)='xrkr80hd@gmail.com' and coalesce(s.dealer_info->'organizationBranding'->org::text->>'deletedAt','')<>'')
 and (p.role='admin' or (m.chat_enabled and (m.organization_id=org or (p.role='sales_manager' and u.raw_app_meta_data->>'workspace_role'='district_manager'))))
 and (not management or p.role in ('admin','sales_manager') or u.raw_app_meta_data->>'workspace_role'='bdm')
); $$;
create function messenger_private.conversation_access(cid uuid)
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.messenger_conversations c where c.id=cid and (
 (c.kind='organization' and messenger_private.organization_access(c.organization_id,c.channel='management') and exists(select 1 from public.profiles p left join public.organization_memberships m on m.user_id=p.id where p.id=auth.uid() and (p.role='admin' or m.can_org_chat))) or
 (c.kind='dm' and exists(select 1 from public.messenger_participants mp
 join public.profiles p on p.id=mp.user_id join auth.users u on u.id=p.id
 left join public.organization_memberships m on m.user_id=p.id
 where mp.conversation_id=c.id and mp.user_id=auth.uid()
 and coalesce((u.raw_app_meta_data->>'must_change_password')::boolean,false)=false
 and (p.role='admin' or (m.chat_enabled and m.can_dm))))
)); $$;
revoke all on function messenger_private.organization_access(uuid,boolean),messenger_private.conversation_access(uuid) from public,anon;
grant execute on function messenger_private.organization_access(uuid,boolean),messenger_private.conversation_access(uuid) to authenticated,service_role;
-- Replace every pre-existing Messenger policy so permissive policies cannot OR around privacy.
do $$ declare p record; begin
for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('messenger_conversations','messenger_participants','messenger_messages') loop
 execute format('drop policy %I on public.%I',p.policyname,p.tablename);
end loop; end $$;
create policy messenger_conversation_read on public.messenger_conversations for select to authenticated using(messenger_private.conversation_access(id));
create policy messenger_participant_read on public.messenger_participants for select to authenticated using(messenger_private.conversation_access(conversation_id));
create policy messenger_message_read on public.messenger_messages for select to authenticated using(messenger_private.conversation_access(conversation_id));
-- All mutations go through checked functions/API; no client can add themselves to a DM.
revoke insert,update,delete on public.messenger_conversations,public.messenger_participants,public.messenger_messages from anon,authenticated;
grant select on public.messenger_conversations,public.messenger_participants,public.messenger_messages to authenticated;

create function messenger_private.provision_channels() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.messenger_conversations(organization_id,kind,channel,title) values
 (new.id,'organization','consultant','Consultant Chat'),(new.id,'organization','management','Management Chat') on conflict do nothing;
 return new; end; $$;
revoke all on function messenger_private.provision_channels() from public,anon,authenticated;
create trigger messenger_organization_channels after insert on public.organizations for each row execute function messenger_private.provision_channels();
insert into public.messenger_conversations(organization_id,kind,channel,title)
select o.id,'organization',v.channel,v.title from public.organizations o cross join (values ('consultant','Consultant Chat'),('management','Management Chat')) v(channel,title) on conflict do nothing;

-- A user-scoped RPC exposes only authorized channel IDs; service API uses this for every action.
create function public.messenger_accessible_organizations() returns setof uuid language sql stable security invoker set search_path='' as $$
 select id from public.organizations where messenger_private.organization_access(id,false);
$$;
revoke all on function public.messenger_accessible_organizations() from public,anon;
grant execute on function public.messenger_accessible_organizations() to authenticated;

-- Atomic DM creation: no partial participant insertion or raced duplicate conversations.
create function messenger_private.start_dm(other uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare mine uuid:=auth.uid(); oid uuid; cid uuid; k text;
begin
 if mine is null or mine=other then raise exception 'Direct-message access denied' using errcode='42501'; end if;
 select m.organization_id into oid from public.organization_memberships m join public.profiles p on p.id=m.user_id join auth.users u on u.id=p.id
 where m.user_id=mine and (p.role='admin' or(m.chat_enabled and m.can_dm)) and coalesce((u.raw_app_meta_data->>'must_change_password')::boolean,false)=false;
 if oid is null then raise exception 'Direct-message access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.organization_memberships m join public.profiles p on p.id=m.user_id where m.user_id=other and m.chat_enabled and m.can_dm
 and messenger_private.organization_access(m.organization_id,false)) then raise exception 'Direct-message access denied' using errcode='42501'; end if;
 k:='walker:'||least(mine::text,other::text)||':'||greatest(mine::text,other::text);
 perform pg_advisory_xact_lock(hashtextextended(k,0));
 select id into cid from public.messenger_conversations where dm_key=k;
 if cid is null then
 insert into public.messenger_conversations(organization_id,kind,dm_key,created_by) values(oid,'dm',k,mine) returning id into cid;
 insert into public.messenger_participants(conversation_id,user_id) values(cid,mine),(cid,other);
 elsif not messenger_private.conversation_access(cid) then raise exception 'Direct-message access denied' using errcode='42501';
 end if;
 return cid;
end; $$;
revoke all on function messenger_private.start_dm(uuid) from public,anon;
grant execute on function messenger_private.start_dm(uuid) to authenticated;
create function public.messenger_start_dm(other uuid) returns uuid language sql security invoker set search_path='' as $$ select messenger_private.start_dm(other); $$;
revoke all on function public.messenger_start_dm(uuid) from public,anon;
grant execute on function public.messenger_start_dm(uuid) to authenticated;
