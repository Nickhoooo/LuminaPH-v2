begin;

-- Saves the suspension status only. App/session/data-access enforcement follows
-- separately; this migration alone does not prevent a suspended user logging in.
create function public.set_account_suspension(
  p_target_user_id uuid,
  p_suspended boolean,
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
  action_name text;
  previous_suspension public.account_suspensions;
  previous_request public.admin_activity_log;
  was_suspended boolean;
  before_details jsonb;
  after_details jsonb;
begin
  -- 1. Validate ang request bago gumawa ng anumang pagbabago.
  if current_user_id is null then
    raise exception 'Please log in.';
  end if;

  if p_suspended is null then
    raise exception 'Choose whether to suspend or restore the account.';
  end if;

  if p_suspended then
    action_name := 'ban_user';
  else
    action_name := 'unban_user';
  end if;

  perform public.require_admin_management_permission(p_target_user_id, action_name);

  if p_request_id is null then
    raise exception 'A request ID is required.';
  end if;

  if char_length(clean_reason) not between 1 and 1000 then
    raise exception 'A reason of 1 to 1000 characters is required.';
  end if;

  -- 2. Same lock order as allowance changes. Recheck permissions under locks
  -- so a concurrent role or account change cannot invalidate authorization.
  perform pg_catalog.pg_advisory_xact_lock(2610070001::bigint);
  perform pg_catalog.pg_advisory_xact_lock(2109202601::bigint);
  perform pg_catalog.pg_advisory_xact_lock(2809202603::bigint);

  perform 1 from auth.users
  where id in (current_user_id, p_target_user_id)
  order by id for update;

  perform 1 from public.app_administrators
  where user_id in (current_user_id, p_target_user_id)
  order by user_id for update;

  perform public.require_admin_management_permission(p_target_user_id, action_name);

  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot manage accounts.';
  end if;

  after_details := jsonb_build_object('suspended', p_suspended);

  -- 3. Same request ID + same inputs = receipt lang, hindi bagong pagbabago.
  -- An old ban retry must not re-ban an account that was later restored.
  select * into previous_request
  from public.admin_activity_log
  where actor_id = current_user_id and request_id = p_request_id;

  if found then
    if previous_request.action is distinct from action_name
      or previous_request.target_user_id is distinct from p_target_user_id
      or previous_request.reason is distinct from clean_reason
      or previous_request.details -> 'after' is distinct from after_details then
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

  was_suspended := found;

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
    'suspendedAt', previous_suspension.suspended_at
  );

  -- 4. Ban = insert record. Unban = remove record. Learning data stays intact.
  if p_suspended then
    insert into public.account_suspensions(user_id, reason, suspended_by)
    values (p_target_user_id, clean_reason, current_user_id);
  else
    delete from public.account_suspensions
    where user_id = p_target_user_id;
  end if;

  -- 5. Status and history are one transaction. Kapag failed ang log,
  -- rolled back din ang status change.
  insert into public.admin_activity_log (
    actor_id, target_user_id, action, reason, request_id, details
  ) values (
    current_user_id, p_target_user_id, action_name, clean_reason, p_request_id,
    jsonb_build_object('before', before_details, 'after', after_details)
  );

  return jsonb_build_object('ok', true, 'duplicate', false, 'after', after_details);
end;
$$;

revoke all on function public.set_account_suspension(uuid, boolean, text, uuid)
  from public, anon, authenticated;

grant execute on function public.set_account_suspension(uuid, boolean, text, uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
