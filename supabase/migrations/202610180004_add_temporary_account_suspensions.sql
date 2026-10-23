begin;

alter table public.account_suspensions
  add column suspended_until timestamptz,
  add constraint account_suspensions_expiry_after_start
    check (suspended_until is null or suspended_until > suspended_at);

-- Expired suspension rows remain for the admin's history, but no longer block
-- the account. A null expiry means a permanent suspension.
create or replace function public.is_current_account_suspended()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.account_suspensions
    where user_id = current_user_id
      and (suspended_until is null or suspended_until > now())
  );
end;
$$;

revoke all on function public.is_current_account_suspended()
  from public, anon, authenticated;
grant execute on function public.is_current_account_suspended()
  to authenticated;

-- Replace the old four-argument action with one that accepts a fixed duration.
drop function public.set_account_suspension(uuid, boolean, text, uuid);

create function public.set_account_suspension(
  p_target_user_id uuid,
  p_suspended boolean,
  p_reason text,
  p_request_id uuid,
  p_duration text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_reason text := trim(coalesce(p_reason, ''));
  action_name text;
  duration_length interval;
  suspension_expiry timestamptz;
  previous_suspension public.account_suspensions;
  previous_request public.admin_activity_log;
  suspension_row_exists boolean;
  was_suspended boolean;
  before_details jsonb;
  after_details jsonb;
begin
  if current_user_id is null then
    raise exception 'Please log in.';
  end if;

  if p_suspended is null then
    raise exception 'Choose whether to suspend or restore the account.';
  end if;

  if p_suspended then
    action_name := 'ban_user';

    if p_duration is null then
      raise exception 'Choose how long the account should be suspended.';
    end if;

    if p_duration = '1h' then
      duration_length := interval '1 hour';
    elsif p_duration = '6h' then
      duration_length := interval '6 hours';
    elsif p_duration = '12h' then
      duration_length := interval '12 hours';
    elsif p_duration = '1d' then
      duration_length := interval '1 day';
    elsif p_duration = '3d' then
      duration_length := interval '3 days';
    elsif p_duration = '7d' then
      duration_length := interval '7 days';
    elsif p_duration = '30d' then
      duration_length := interval '30 days';
    elsif p_duration = 'permanent' then
      duration_length := null;
    else
      raise exception 'Choose one of the available suspension durations.';
    end if;
  else
    action_name := 'unban_user';
    if p_duration is not null then
      raise exception 'A restore action cannot include a suspension duration.';
    end if;
  end if;

  perform public.require_admin_management_permission(p_target_user_id, action_name);

  if p_request_id is null then
    raise exception 'A request ID is required.';
  end if;

  if char_length(clean_reason) not between 1 and 1000 then
    raise exception 'A reason of 1 to 1000 characters is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(2610070001::bigint);
  perform pg_catalog.pg_advisory_xact_lock(2109202601::bigint);
  perform pg_catalog.pg_advisory_xact_lock(2809202603::bigint);

  perform 1
  from auth.users
  where id in (current_user_id, p_target_user_id)
  order by id
  for update;

  perform 1
  from public.app_administrators
  where user_id in (current_user_id, p_target_user_id)
  order by user_id
  for update;

  perform public.require_admin_management_permission(p_target_user_id, action_name);

  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot manage accounts.';
  end if;

  if p_suspended and duration_length is not null then
    suspension_expiry := now() + duration_length;
  else
    suspension_expiry := null;
  end if;

  after_details := jsonb_build_object(
    'suspended', p_suspended,
    'suspendedUntil', suspension_expiry
  );

  select * into previous_request
  from public.admin_activity_log
  where actor_id = current_user_id
    and request_id = p_request_id;

  if found then
    if previous_request.action is distinct from action_name
      or previous_request.target_user_id is distinct from p_target_user_id
      or previous_request.reason is distinct from clean_reason
      or previous_request.details -> 'after' -> 'suspended' is distinct from after_details -> 'suspended'
      or previous_request.details -> 'duration' is distinct from coalesce(to_jsonb(p_duration), 'null'::jsonb) then
      raise exception 'This request ID was already used for a different change.';
    end if;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'after', previous_request.details -> 'after'
    );
  end if;

  select * into previous_suspension
  from public.account_suspensions
  where user_id = p_target_user_id
  for update;

  suspension_row_exists := found;
  was_suspended := suspension_row_exists and (
    previous_suspension.suspended_until is null
    or previous_suspension.suspended_until > now()
  );

  if was_suspended = p_suspended then
    if p_suspended then
      raise exception 'This account is already suspended.';
    else
      raise exception 'This account is not suspended.';
    end if;
  end if;

  before_details := jsonb_build_object(
    'suspended', was_suspended,
    'reason', previous_suspension.reason,
    'suspendedBy', previous_suspension.suspended_by,
    'suspendedAt', previous_suspension.suspended_at,
    'suspendedUntil', previous_suspension.suspended_until
  );

  if p_suspended then
    if suspension_row_exists then
      update public.account_suspensions
      set reason = clean_reason,
          suspended_by = current_user_id,
          suspended_at = now(),
          suspended_until = suspension_expiry
      where user_id = p_target_user_id;
    else
      insert into public.account_suspensions (
        user_id, reason, suspended_by, suspended_until
      ) values (
        p_target_user_id, clean_reason, current_user_id, suspension_expiry
      );
    end if;
  else
    delete from public.account_suspensions
    where user_id = p_target_user_id;
  end if;

  insert into public.admin_activity_log (
    actor_id, target_user_id, action, reason, request_id, details
  ) values (
    current_user_id, p_target_user_id, action_name, clean_reason, p_request_id,
    jsonb_build_object(
      'before', before_details,
      'after', after_details,
      'duration', p_duration
    )
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'after', after_details
  );
end;
$$;

revoke all on function public.set_account_suspension(uuid, boolean, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_account_suspension(uuid, boolean, text, uuid, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
