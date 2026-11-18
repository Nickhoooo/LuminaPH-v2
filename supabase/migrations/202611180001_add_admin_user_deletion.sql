begin;

-- Check deletion eligibility with the user's authenticated session before the
-- server uses its private Auth Admin key.
create function public.authorize_admin_user_deletion(p_target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  perform public.require_admin_management_permission(p_target_user_id, 'delete_user');
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot manage accounts.';
  end if;
  if not exists (
    select 1 from public.account_suspensions
    where user_id = p_target_user_id
      and (suspended_until is null or suspended_until > now())
  ) then
    raise exception 'Suspend the account before permanently deleting it.';
  end if;
  return true;
end;
$$;

-- The target row has already been removed through Supabase Auth Admin API.
-- Keep its UUID in the activity log for an audit trail after deletion.
create function public.record_admin_user_deletion(
  p_target_user_id uuid,
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
  previous_request public.admin_activity_log;
begin
  if current_user_id is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if p_target_user_id is null or p_request_id is null then
    raise exception 'An account and request ID are required.';
  end if;
  if char_length(clean_reason) not between 1 and 1000 then
    raise exception 'A reason of 1 to 1000 characters is required.';
  end if;
  if exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'The account must be deleted before recording this action.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(2610070001::bigint);

  select * into previous_request
  from public.admin_activity_log
  where actor_id = current_user_id and request_id = p_request_id;

  if found then
    if previous_request.action is distinct from 'delete_user'
      or previous_request.target_user_id is distinct from p_target_user_id
      or previous_request.reason is distinct from clean_reason then
      raise exception 'This request ID was already used for a different change.';
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  insert into public.admin_activity_log (
    actor_id, target_user_id, action, reason, request_id, details
  ) values (
    current_user_id, p_target_user_id, 'delete_user', clean_reason,
    p_request_id, jsonb_build_object('permanent', true)
  );

  return jsonb_build_object('ok', true, 'duplicate', false);
end;
$$;

revoke all on function public.record_admin_user_deletion(uuid, text, uuid)
  from public, anon;
grant execute on function public.record_admin_user_deletion(uuid, text, uuid)
  to authenticated;
revoke all on function public.authorize_admin_user_deletion(uuid)
  from public, anon;
grant execute on function public.authorize_admin_user_deletion(uuid)
  to authenticated;

notify pgrst, 'reload schema';
commit;
