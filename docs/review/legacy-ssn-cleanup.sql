-- REVIEW ONLY. Not a migration. Never executed by this remediation.
-- Have the authorized database owner review against the deployed schema and retention jobs.
-- Backups need their own provider-managed handling. Do not export customer values.
begin;
create or replace function pg_temp.strip_legacy_ssn(value jsonb)
returns jsonb language plpgsql as $$
declare cleaned jsonb;
begin
 if jsonb_typeof(value) = 'object' then
  select coalesce(jsonb_object_agg(key, pg_temp.strip_legacy_ssn(val)), '{}'::jsonb)
  into cleaned from jsonb_each(value) as entries(key,val)
  where regexp_replace(lower(key),'[^a-z0-9]','','g') not like '%socialsecurity%'
    and regexp_replace(lower(key),'[^a-z0-9]','','g') not like '%ssn%';
  return cleaned;
 elsif jsonb_typeof(value) = 'array' then
  select coalesce(jsonb_agg(pg_temp.strip_legacy_ssn(val) order by ordinal), '[]'::jsonb)
  into cleaned from jsonb_array_elements(value) with ordinality as entries(val,ordinal);
  return cleaned;
 end if;
 return value;
end; $$;
-- Counts only, no sensitive values or customer identifiers.
select count(*) as affected_deal_count from public.deals
where workflow_data is distinct from pg_temp.strip_legacy_ssn(workflow_data)
   or signatures is distinct from pg_temp.strip_legacy_ssn(signatures);
-- Proposed update, intentionally commented out. Its updated_at trigger may affect
-- any deployed cleanup job based on updated_at; review before authorizing execution.
-- update public.deals
-- set workflow_data = pg_temp.strip_legacy_ssn(workflow_data),
--     signatures = pg_temp.strip_legacy_ssn(signatures)
-- where workflow_data is distinct from pg_temp.strip_legacy_ssn(workflow_data)
--    or signatures is distinct from pg_temp.strip_legacy_ssn(signatures);
rollback;
-- Separately review adding a database CHECK/trigger to strip these properties on
-- direct authenticated writes. API validation alone doesn't cover Data API writes.
