begin;

-- 1. Kunin ang effective limits na gagamitin sa generation at usage display.
-- Developer access stays separate. Sa SQL SELECT, CASE WHEN ang katumbas ng if/else.
create function public.effective_generation_allowance(p_user_id uuid)
returns table (mode text, material_limit integer, tutor_limit integer, developer boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when d.user_id is not null then 'unlimited' else coalesce(a.mode, 'default') end,
    case when d.user_id is not null or a.mode = 'unlimited' then null
      when a.mode = 'custom' then a.material_limit else 5 end,
    case when d.user_id is not null or a.mode = 'unlimited' then null
      when a.mode = 'custom' then a.tutor_limit else 20 end,
    d.user_id is not null
  from (select p_user_id as user_id) target
  left join public.user_generation_allowances a on a.user_id = target.user_id
  left join public.ai_generation_developers d on d.user_id = target.user_id;
$$;

revoke all on function public.effective_generation_allowance(uuid)
  from public, anon, authenticated;

-- 2. I-save ang allowance at audit log sa iisang transaction.
create or replace function public.set_user_generation_allowance(
  p_target_user_id uuid, p_mode text, p_material_limit integer,
  p_tutor_limit integer, p_reason text, p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_reason text := trim(coalesce(p_reason, ''));
  before_row public.user_generation_allowances;
  previous_request public.admin_activity_log;
  before_json jsonb;
  after_json jsonb;
begin
  if current_user_id is null then
    raise exception 'Please log in.';
  end if;
  if public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if p_request_id is null then
    raise exception 'A request ID is required.';
  end if;
  if p_mode is null or p_mode not in ('default', 'custom', 'unlimited') then
    raise exception 'Invalid allowance mode.';
  end if;
  if p_mode = 'custom' then
    if p_material_limit is null or p_tutor_limit is null
      or p_material_limit not between 1 and 1000 or p_tutor_limit not between 1 and 1000 then
      raise exception 'Custom limits must be whole numbers from 1 to 1000.';
    end if;
  elsif p_material_limit is not null or p_tutor_limit is not null then
    raise exception 'Limits are only allowed in custom mode.';
  end if;
  if char_length(clean_reason) not between 1 and 1000 then
    raise exception 'A reason of 1 to 1000 characters is required.';
  end if;

  -- Future role/ban/delete actions must use this management lock and the same
  -- account lock order. Reservation locks serialize cap changes with new attempts.
  perform pg_catalog.pg_advisory_xact_lock(2610070001::bigint);
  perform pg_catalog.pg_advisory_xact_lock(2109202601::bigint);
  perform pg_catalog.pg_advisory_xact_lock(2809202603::bigint);
  perform 1 from auth.users where id in (current_user_id, p_target_user_id)
    order by id for update;
  perform 1 from public.app_administrators where user_id in (current_user_id, p_target_user_id)
    order by user_id for update;
  if public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  perform public.require_admin_management_permission(p_target_user_id, 'set_usage');
  if exists (select 1 from public.ai_generation_developers where user_id = p_target_user_id) then
    raise exception 'Developer access is managed separately.';
  end if;

  -- Ito ang bagong settings na gustong i-save ng admin.
  after_json := jsonb_build_object('mode', p_mode,
    'materialLimit', p_material_limit, 'tutorLimit', p_tutor_limit);
  -- Same request ID + same change: ibalik ang receipt, huwag ulitin ang save.
  select * into previous_request from public.admin_activity_log
    where actor_id = current_user_id and request_id = p_request_id;
  if found then
    if previous_request.action is distinct from 'set_usage'
      or previous_request.target_user_id is distinct from p_target_user_id
      or previous_request.reason is distinct from clean_reason
      or previous_request.details -> 'after' is distinct from after_json then
      raise exception 'This request ID was already used for a different change.';
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'after', previous_request.details -> 'after');
  end if;

  select * into before_row from public.user_generation_allowances
    where user_id = p_target_user_id for update;
  before_json := jsonb_build_object('mode', coalesce(before_row.mode, 'default'),
    'materialLimit', before_row.material_limit, 'tutorLimit', before_row.tutor_limit);
  if before_json = after_json then
    raise exception 'Allowance is already set to these values.';
  end if;

  insert into public.user_generation_allowances(user_id, mode, material_limit, tutor_limit, updated_by, updated_at)
  values (p_target_user_id, p_mode, p_material_limit, p_tutor_limit, current_user_id, now())
  on conflict (user_id) do update set mode = excluded.mode,
    material_limit = excluded.material_limit, tutor_limit = excluded.tutor_limit,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into public.admin_activity_log(actor_id, target_user_id, action, reason, request_id, details)
  values (current_user_id, p_target_user_id, 'set_usage', clean_reason, p_request_id,
    jsonb_build_object('before', before_json, 'after', after_json));
  return jsonb_build_object('ok', true, 'duplicate', false, 'after', after_json);
end;
$$;

-- 3. Mag-check ng allowance bago mag-reserve ng material-generation attempt.
create or replace function public.reserve_ai_generation()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  checked_at timestamptz;
  allowance record;
  user_attempts bigint;
  app_attempts bigint;
begin
  if current_user_id is null then
    return 'unauthorized';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(2109202601::bigint);
  checked_at := pg_catalog.clock_timestamp();
  select * into allowance from public.effective_generation_allowance(current_user_id);
  -- Existing developer accounts keep their testing bypass.
  if allowance.developer then
    insert into public.ai_generation_attempts(user_id, created_at) values (current_user_id, checked_at);
    return 'allowed';
  end if;
  if exists (select 1 from public.ai_generation_attempts
    where user_id = current_user_id and created_at > checked_at - interval '60 seconds') then
    return 'cooldown';
  end if;
  select count(*) into user_attempts from public.ai_generation_attempts
    where user_id = current_user_id and created_at > checked_at - interval '24 hours';
  if allowance.material_limit is not null and user_attempts >= allowance.material_limit then
    return 'user_limit';
  end if;
  -- Unlimited personal allowance still follows this shared app limit.
  select count(*) into app_attempts from public.ai_generation_attempts a
    where a.created_at > checked_at - interval '24 hours'
      and not exists (select 1 from public.ai_generation_developers d where d.user_id = a.user_id);
  if app_attempts >= 50 then
    return 'app_limit';
  end if;
  insert into public.ai_generation_attempts(user_id, created_at) values (current_user_id, checked_at);
  return 'allowed';
end;
$$;

-- 4. Parehong flow para sa tutor, pero hiwalay ang cooldown at limits nito.
create or replace function public.reserve_tutor_generation(p_conversation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  checked_at timestamptz;
  allowance record;
  user_attempts bigint;
  app_attempts bigint;
begin
  if current_user_id is null then
    return 'unauthorized';
  end if;
  if not exists (
    select 1 from public.tutor_conversations c join public.study_sets s on s.id = c.study_set_id
    where c.id = p_conversation_id and c.user_id = current_user_id
      and s.user_id = current_user_id and s.material_type = 'study_guide'
  ) then
    return 'unavailable';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(2809202603::bigint);
  checked_at := pg_catalog.clock_timestamp();
  select * into allowance from public.effective_generation_allowance(current_user_id);
  -- Existing developer accounts keep their testing bypass.
  if allowance.developer then
    insert into public.tutor_generation_attempts(user_id, created_at) values (current_user_id, checked_at);
    return 'allowed';
  end if;
  if exists (select 1 from public.tutor_generation_attempts
    where user_id = current_user_id and created_at > checked_at - interval '10 seconds') then
    return 'cooldown';
  end if;
  select count(*) into user_attempts from public.tutor_generation_attempts
    where user_id = current_user_id and created_at > checked_at - interval '24 hours';
  if allowance.tutor_limit is not null and user_attempts >= allowance.tutor_limit then
    return 'user_limit';
  end if;
  -- Unlimited personal allowance still follows this shared app limit.
  select count(*) into app_attempts from public.tutor_generation_attempts a
    where a.created_at > checked_at - interval '24 hours'
      and not exists (select 1 from public.ai_generation_developers d where d.user_id = a.user_id);
  if app_attempts >= 200 then
    return 'app_limit';
  end if;
  insert into public.tutor_generation_attempts(user_id, created_at) values (current_user_id, checked_at);
  return 'allowed';
end;
$$;

-- 5. Basahin ang counts at permissions para sa admin profile modal.
create or replace function public.get_admin_user_usage(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  checked_at timestamptz := now();
  allowance record;
  target_role text;
  material_count bigint;
  tutor_count bigint;
  material_next_expiry timestamptz;
  tutor_next_expiry timestamptz;
  edit_reason text;
begin
  if auth.uid() is null or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;
  if p_user_id is null then
    raise exception 'A user ID is required.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    return null;
  end if;
  select * into allowance from public.effective_generation_allowance(p_user_id);
  select role into target_role from public.app_administrators where user_id = p_user_id;
  edit_reason := case
    when public.is_super_administrator() is not true then 'Only a Super Admin can change usage allowances.'
    when target_role = 'super_admin' then 'Super Admin accounts are protected.'
    when p_user_id = auth.uid() then 'You cannot change your own allowance here.'
    when allowance.developer then 'Developer access is managed separately.'
    else null end;
  select count(*), min(created_at) + interval '24 hours' into material_count, material_next_expiry
    from public.ai_generation_attempts
    where user_id = p_user_id and created_at > checked_at - interval '24 hours';
  select count(*), min(created_at) + interval '24 hours' into tutor_count, tutor_next_expiry
    from public.tutor_generation_attempts
    where user_id = p_user_id and created_at > checked_at - interval '24 hours';
  return jsonb_build_object(
    'userId', p_user_id, 'checkedAt', checked_at, 'mode', allowance.mode,
    'canEdit', edit_reason is null, 'editReason', edit_reason,
    'source', case when allowance.developer then 'developer' else 'allowance' end,
    'materials', jsonb_build_object('attempts24h', material_count, 'limit', allowance.material_limit,
      'remaining', case when allowance.material_limit is null then null else greatest(0::bigint, allowance.material_limit - material_count) end,
      'nextAttemptExpiresAt', material_next_expiry),
    'tutor', jsonb_build_object('attempts24h', tutor_count, 'limit', allowance.tutor_limit,
      'remaining', case when allowance.tutor_limit is null then null else greatest(0::bigint, allowance.tutor_limit - tutor_count) end,
      'nextAttemptExpiresAt', tutor_next_expiry)
  );
end;
$$;

revoke all on function public.set_user_generation_allowance(uuid, text, integer, integer, text, uuid) from public, anon;
revoke all on function public.reserve_ai_generation() from public, anon;
revoke all on function public.reserve_tutor_generation(uuid) from public, anon;
revoke all on function public.get_admin_user_usage(uuid) from public, anon;
grant execute on function public.set_user_generation_allowance(uuid, text, integer, integer, text, uuid) to authenticated;
grant execute on function public.reserve_ai_generation() to authenticated;
grant execute on function public.reserve_tutor_generation(uuid) to authenticated;
grant execute on function public.get_admin_user_usage(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
