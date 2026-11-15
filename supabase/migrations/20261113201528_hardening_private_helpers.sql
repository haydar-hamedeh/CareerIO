-- Hardening after Supabase advisors:
-- policy helper functions move to a schema the Data API does not expose, and
-- Supabase's rls_auto_enable() event-trigger function is not callable via the API.
-- Policies reference functions by OID, so they keep working after the move.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.app_role() set schema private;
alter function public.owns_company(uuid) set schema private;
alter function public.owns_job(uuid) set schema private;
alter function public.applied_to_my_jobs(uuid) set schema private;
alter function public.cv_in_my_applications(uuid) set schema private;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
