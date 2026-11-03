begin;
create schema if not exists security_private;
revoke all on schema security_private from public,anon;
grant usage on schema security_private to authenticated,service_role;
create or replace function security_private.can_access_deal_owner(target_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(
 select 1 from public.profiles p where p.id=auth.uid() and (
 p.role='admin' or target_user=auth.uid()
 or (p.role in ('sales_manager','fni') and (
 (p.role='sales_manager' and auth.jwt()->'app_metadata'->>'workspace_role'='district_manager')
 or exists(select 1 from public.organization_memberships me join public.organization_memberships target on target.organization_id=me.organization_id where me.user_id=auth.uid() and target.user_id=target_user)
 ))));
$$;
revoke all on function security_private.can_access_deal_owner(uuid) from public,anon;
grant execute on function security_private.can_access_deal_owner(uuid) to authenticated,service_role;
alter policy "FNI read fni-ready deals" on public.deals to authenticated using(
fni_ready and security_private.can_access_deal_owner(user_id) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='fni'));
alter policy "Sales manager read fni-ready deals" on public.deals to authenticated using(
(sm_ready or fni_ready) and security_private.can_access_deal_owner(user_id) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='sales_manager'));
alter policy "Role users read own notifications" on public.notifications to authenticated using(
exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=notifications.recipient_role)
and (deal_id is null or exists(select 1 from public.deals d where d.id=notifications.deal_id and security_private.can_access_deal_owner(d.user_id))));
alter policy "Role users update own notifications" on public.notifications to authenticated using(
exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=notifications.recipient_role)
and (deal_id is null or exists(select 1 from public.deals d where d.id=notifications.deal_id and security_private.can_access_deal_owner(d.user_id))));
commit;

