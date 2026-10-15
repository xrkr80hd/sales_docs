-- Read markers only advance, even when two devices finish requests out of order.
create function messenger_private.mark_read(cid uuid, mid bigint) returns void
language plpgsql security definer set search_path='' as $$
declare stamp timestamptz;
begin
 if auth.uid() is null or not messenger_private.conversation_access(cid) then raise exception 'Conversation access denied' using errcode='42501'; end if;
 select created_at into stamp from public.messenger_messages where id=mid and conversation_id=cid;
 if stamp is null then raise exception 'Message access denied' using errcode='42501'; end if;
 insert into public.messenger_participants(conversation_id,user_id,last_read_at) values(cid,auth.uid(),stamp)
 on conflict(conversation_id,user_id) do update set last_read_at=greatest(public.messenger_participants.last_read_at,excluded.last_read_at);
end; $$;
revoke all on function messenger_private.mark_read(uuid,bigint) from public,anon;
grant execute on function messenger_private.mark_read(uuid,bigint) to authenticated;
create function public.messenger_mark_read(cid uuid, mid bigint) returns void
language sql security invoker set search_path='' as $$ select messenger_private.mark_read(cid,mid); $$;
revoke all on function public.messenger_mark_read(uuid,bigint) from public,anon;
grant execute on function public.messenger_mark_read(uuid,bigint) to authenticated;
