begin;

-- Only signed-in administrators can read account roles.
create function public.get_admin_role(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  saved_role text;
begin
  if auth.uid() is null or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;

  if p_user_id is null then
    raise exception 'An account is required.';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Account unavailable.';
  end if;

  select role into saved_role
  from public.app_administrators
  where user_id = p_user_id;

  return saved_role;
end;
$$;

-- Manage regular Admin access only. Super Admin assignment is never exposed.
create function public.set_regular_admin_role(
  p_target_user_id uuid,
  p_grant_admin boolean,
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
  target_role text;
  previous_request public.admin_activity_log;
  before_details jsonb;
  after_details jsonb;
begin
  if current_user_id is null then
    raise exception 'Please log in.';
  end if;

  if p_grant_admin is null then
    raise exception 'Choose whether to grant or remove Admin access.';
  end if;

  if p_grant_admin then
    action_name := 'grant_admin';
    after_details := jsonb_build_object('role', 'admin');
  else
    action_name := 'revoke_admin';
    after_details := jsonb_build_object('role', null::text);
  end if;

  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot manage accounts.';
  end if;

  if public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;

  if p_request_id is null then
    raise exception 'A request ID is required.';
  end if;

  if char_length(clean_reason) not between 1 and 1000 then
    raise exception 'A reason of 1 to 1000 characters is required.';
  end if;

  -- Use the same lock order as other account-management actions.
  perform pg_catalog.pg_advisory_xact_lock(2610070001::bigint);

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

  -- Check permissions again after acquiring the locks.
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot manage accounts.';
  end if;

  if public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;

  perform public.require_admin_management_permission(p_target_user_id, action_name);

  select role into target_role
  from public.app_administrators
  where user_id = p_target_user_id
  for update;

  if target_role = 'super_admin' then
    raise exception 'Super Admin accounts are protected.';
  end if;

  select * into previous_request
  from public.admin_activity_log
  where actor_id = current_user_id
    and request_id = p_request_id;

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

  before_details := jsonb_build_object('role', target_role);

  if p_grant_admin then
    if target_role is not null then
      raise exception 'This account is already an Admin.';
    end if;

    insert into public.app_administrators(user_id, role)
    values (p_target_user_id, 'admin');
  else
    if target_role is null then
      raise exception 'This account does not have Admin access.';
    end if;

    delete from public.app_administrators
    where user_id = p_target_user_id
      and role = 'admin';
  end if;

  insert into public.admin_activity_log (
    actor_id, target_user_id, action, reason, request_id, details
  ) values (
    current_user_id, p_target_user_id, action_name, clean_reason, p_request_id,
    jsonb_build_object('before', before_details, 'after', after_details)
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'after', after_details
  );
end;
$$;

revoke all on function public.get_admin_role(uuid) from public, anon;
grant execute on function public.get_admin_role(uuid) to authenticated;

revoke all on function public.set_regular_admin_role(uuid, boolean, text, uuid)
  from public, anon;
grant execute on function public.set_regular_admin_role(uuid, boolean, text, uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
