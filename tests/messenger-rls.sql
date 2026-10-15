-- Run with a database-owner connection. All fixture changes are rolled back.
begin;
create temporary table messenger_test_context (consultant uuid, peer uuid, manager uuid, admin uuid, org uuid, other_org uuid, dm uuid);
insert into messenger_test_context(consultant,peer,manager,admin,org,other_org)
select (select id from public.profiles where role='user' order by id limit 1),(select id from public.profiles where role='user' order by id offset 1 limit 1),(select id from public.profiles where role='sales_manager' order by id limit 1),(select id from public.profiles where role='admin' order by id limit 1),gen_random_uuid(),gen_random_uuid();
grant select,update on messenger_test_context to authenticated;
insert into public.organizations(id,name,slug) select org,'Transactional Messenger test '||org,org::text from messenger_test_context;
insert into public.organizations(id,name,slug) select other_org,'Transactional Messenger test '||other_org,other_org::text from messenger_test_context;
update public.organization_memberships m set organization_id=t.org,chat_enabled=true,can_dm=true,can_org_chat=true from messenger_test_context t where m.user_id in(t.consultant,t.peer,t.manager);
-- Temporarily clear forced-password flag for test identities only; rollback restores it.
update auth.users u set raw_app_meta_data=raw_app_meta_data-'must_change_password' from messenger_test_context t where u.id in(t.consultant,t.peer,t.manager,t.admin);
select set_config('request.jwt.claim.sub',(select consultant::text from messenger_test_context),true);
set local role authenticated;
do $$ declare t record; cid uuid; begin
 select * into t from messenger_test_context;
 if (select count(*) from public.messenger_conversations where organization_id=t.org and channel='consultant')<>1 then raise exception 'FAIL consultant channel access';end if;
 if exists(select 1 from public.messenger_conversations where organization_id=t.org and channel='management') then raise exception 'FAIL consultant discovered management';end if;
 if exists(select 1 from public.messenger_conversations where organization_id=t.other_org) then raise exception 'FAIL cross-organization access';end if;
 cid:=public.messenger_start_dm(t.peer);
 update messenger_test_context set dm=cid;
 if public.messenger_start_dm(t.peer)<>cid then raise exception 'FAIL duplicate DM';end if;
 if (select count(*) from public.messenger_participants where conversation_id=cid)<>2 then raise exception 'FAIL atomic participants';end if;
 begin insert into public.messenger_participants(conversation_id,user_id) values(cid,t.manager); raise exception 'FAIL participant injection allowed'; exception when insufficient_privilege then null;end;
 begin insert into public.messenger_messages(conversation_id,sender_id,body) values(cid,t.peer,'test'); raise exception 'FAIL spoofed sender allowed'; exception when insufficient_privilege then null;end;
 begin perform public.messenger_start_dm(t.consultant);raise exception 'FAIL self DM allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.messenger_messages(conversation_id,sender_id,body) select dm,peer,'Transactional persistence verification' from messenger_test_context;
update public.messenger_participants set last_read_at='1970-01-01' where conversation_id=(select dm from messenger_test_context);
select set_config('request.jwt.claim.sub',(select manager::text from messenger_test_context),true);
set local role authenticated;
do $$ declare t record;begin
 select * into t from messenger_test_context;
 if (select count(*) from public.messenger_conversations where organization_id=t.org and kind='organization')<>2 then raise exception 'FAIL manager channels';end if;
 if exists(select 1 from public.messenger_conversations where id=t.dm) then raise exception 'FAIL manager saw employee DM';end if;
 if exists(select 1 from public.messenger_messages where conversation_id=t.dm) then raise exception 'FAIL manager saw employee messages';end if;
 if exists(select 1 from public.messenger_participants where conversation_id=t.dm) then raise exception 'FAIL manager saw participants';end if;
 begin perform public.messenger_mark_read(t.dm,1);raise exception 'FAIL manager marked employee DM read';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select admin::text from messenger_test_context),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.messenger_messages where conversation_id=(select dm from messenger_test_context)) then raise exception 'FAIL admin DM bypass';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select consultant::text from messenger_test_context),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.messenger_messages where conversation_id=(select dm from messenger_test_context))<>1 then raise exception 'FAIL persisted participant history';end if;
 perform public.messenger_mark_read((select dm from messenger_test_context),(select id from public.messenger_messages where conversation_id=(select dm from messenger_test_context)));
 if (select last_read_at from public.messenger_participants where conversation_id=(select dm from messenger_test_context) and user_id=auth.uid()) <> (select created_at from public.messenger_messages where conversation_id=(select dm from messenger_test_context)) then raise exception 'FAIL read marker';end if;
end $$;
reset role;
update public.organization_memberships set chat_enabled=false where user_id=(select consultant from messenger_test_context);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.messenger_messages where conversation_id=(select dm from messenger_test_context)) then raise exception 'FAIL disabled member retained access';end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.messenger_start_dm(uuid)','EXECUTE') then raise exception 'FAIL anonymous DM RPC';end if;
 if has_table_privilege('authenticated','public.messenger_messages','UPDATE') then raise exception 'FAIL direct message write privilege';end if;
end $$;
rollback;
select 'PASS: consultant/manager separation, cross-organization isolation, participant-only DMs including admins, atomic DM reuse, participant injection and sender spoof rejection, persisted history, revoked access, anonymous RPC denial; fixture changes rolled back' result;
