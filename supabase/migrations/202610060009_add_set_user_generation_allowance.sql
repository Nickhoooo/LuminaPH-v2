begin;

-- 1. Dagdag na columns sa activity log
alter table public.admin_activity_log
  add column request_id uuid,
  add column details jsonb;

-- 2. Para hindi madoble ang log kapag nag-retry ang same request
create unique index admin_activity_log_request_idx
  on public.admin_activity_log(actor_id, request_id)
  where request_id is not null;

-- 3. Ang save function
create function public.set_user_generation_allowance(
  p_target_user_id uuid,
  p_mode text,
  p_material_limit integer,
  p_tutor_limit integer,
  p_reason text,
  p_request_id uuid
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
  before_json jsonb;
  after_json jsonb;
  existing_details jsonb;
begin
  if current_user_id is null then
    raise exception 'Please log in.';
  end if;

  if not exists (
    select 1
    from public.app_administrators a
    where a.user_id = current_user_id
      and a.role = 'super_admin'
  ) then
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
       or p_material_limit not between 1 and 1000
       or p_tutor_limit not between 1 and 1000 then
      raise exception 'Custom limits must be whole numbers from 1 to 1000.';
    end if;
  elsif p_material_limit is not null or p_tutor_limit is not null then
    raise exception 'Limits are only allowed in custom mode.';
  end if;

  if char_length(clean_reason) not between 1 and 1000 then
    raise exception 'A reason of 1 to 1000 characters is required.';
  end if;

  -- Isang shared lock para sa lahat ng admin management actions
  perform pg_advisory_xact_lock(2610070001);

  -- Re-check ng permission habang naka-lock na
  perform public.require_admin_management_permission(
    p_target_user_id, 'set_usage'
  );

  -- Retry check: kung nai-save na ang request na ito, ibalik lang ang result
  select l.details into existing_details
  from public.admin_activity_log l
  where l.actor_id = current_user_id
    and l.request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'after', existing_details -> 'after'
    );
  end if;

  select * into before_row
  from public.user_generation_allowances
  where user_id = p_target_user_id;

  before_json := jsonb_build_object(
    'mode', coalesce(before_row.mode, 'default'),
    'materialLimit', before_row.material_limit,
    'tutorLimit', before_row.tutor_limit
  );

  after_json := jsonb_build_object(
    'mode', p_mode,
    'materialLimit', p_material_limit,
    'tutorLimit', p_tutor_limit
  );

  if before_json = after_json then
    raise exception 'Allowance is already set to these values.';
  end if;

  insert into public.user_generation_allowances (
    user_id, mode, material_limit, tutor_limit, updated_by, updated_at
  )
  values (
    p_target_user_id, p_mode, p_material_limit, p_tutor_limit,
    current_user_id, now()
  )
  on conflict (user_id) do update
  set mode = excluded.mode,
      material_limit = excluded.material_limit,
      tutor_limit = excluded.tutor_limit,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.admin_activity_log (
    actor_id, target_user_id, action, reason, request_id, details
  )
  values (
    current_user_id, p_target_user_id, 'set_usage', clean_reason,
    p_request_id,
    jsonb_build_object('before', before_json, 'after', after_json)
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'after', after_json
  );
end;
$$;

revoke all on function public.set_user_generation_allowance(
  uuid, text, integer, integer, text, uuid
) from public, anon;

grant execute on function public.set_user_generation_allowance(
  uuid, text, integer, integer, text, uuid
) to authenticated;

commit;