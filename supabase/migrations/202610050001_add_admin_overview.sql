begin;

-- Aggregate totals only. No private learning content is returned.
create function public.get_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  window_start timestamptz := now() - interval '24 hours';
begin
  if auth.uid() is null
    or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;

  return pg_catalog.jsonb_build_object(
    'totalUsers', (
      select count(*) from auth.users
    ),
    'totalStudyGroups', (
      select count(*) from public.study_groups
    ),
    'totalMaterials', (
      select count(*) from public.study_sets
    ),
    'materialAttempts24h', (
      select count(*)
      from public.ai_generation_attempts
      where created_at >= window_start
    ),
    'tutorAttempts24h', (
      select count(*)
      from public.tutor_generation_attempts
      where created_at >= window_start
    ),
    'checkedAt', now()
  );
end;
$$;

revoke all on function public.get_admin_overview()
  from public, anon, authenticated;

grant execute on function public.get_admin_overview()
  to authenticated;

commit;