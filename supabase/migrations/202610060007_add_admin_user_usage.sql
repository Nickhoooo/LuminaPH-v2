begin;

create function public.get_admin_user_usage(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  checked_at timestamptz := now();
  unlimited_access boolean;
  material_count bigint;
  tutor_count bigint;
  material_next_expiry timestamptz;
  tutor_next_expiry timestamptz;
begin
  -- Verify the caller, not the selected account.
  if auth.uid() is null
    or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;

  if p_user_id is null then
    raise exception 'A user ID is required.';
  end if;

  if not exists (
    select 1 from auth.users where id = p_user_id
  ) then
    return null;
  end if;

  -- Reuse the same unlimited-access rule as generation.
  select exists (
    select 1
    from public.ai_generation_developers
    where user_id = p_user_id
  ) into unlimited_access;

  select
    count(*),
    min(created_at) + interval '24 hours'
  into material_count, material_next_expiry
  from public.ai_generation_attempts
  where user_id = p_user_id
    and created_at > checked_at - interval '24 hours';

  select
    count(*),
    min(created_at) + interval '24 hours'
  into tutor_count, tutor_next_expiry
  from public.tutor_generation_attempts
  where user_id = p_user_id
    and created_at > checked_at - interval '24 hours';

  return pg_catalog.jsonb_build_object(
    'userId', p_user_id,
    'checkedAt', checked_at,
    'mode', case
      when unlimited_access then 'unlimited'
      else 'default'
    end,
    'materials', pg_catalog.jsonb_build_object(
      'attempts24h', material_count,
      'limit', case when unlimited_access then null else 5 end,
      'remaining', case
        when unlimited_access then null
        else greatest(0::bigint, 5 - material_count)
      end,
      'nextAttemptExpiresAt', material_next_expiry
    ),
    'tutor', pg_catalog.jsonb_build_object(
      'attempts24h', tutor_count,
      'limit', case when unlimited_access then null else 20 end,
      'remaining', case
        when unlimited_access then null
        else greatest(0::bigint, 20 - tutor_count)
      end,
      'nextAttemptExpiresAt', tutor_next_expiry
    )
  );
end;
$$;

revoke all on function public.get_admin_user_usage(uuid)
  from public, anon, authenticated;

grant execute on function public.get_admin_user_usage(uuid)
  to authenticated;

commit;