begin;
alter function public.cleanup_expired_deals() set search_path = '';
create or replace function public.cleanup_expired_deals() returns void language plpgsql security definer set search_path = '' as $$
begin
delete from public.deals where status = 'finished' and finished_at < now() - interval '8 hours';
end;
$$;
revoke execute on function public.cleanup_expired_deals() from public, anon, authenticated;
grant execute on function public.cleanup_expired_deals() to service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_consultant_media_bucket() from public, anon, authenticated;
alter function public.set_deals_updated_at() set search_path = '';
commit;

