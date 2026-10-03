begin;

-- A member can leave only using their own logged-in account.
create function public.leave_study_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  group_owner_id uuid;
begin
  if current_user_id is null then
    raise exception 'Please log in before leaving a group.';
  end if;

  -- Lock the group while checking ownership and removing membership.
  select owner_id into group_owner_id
  from public.study_groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'Group unavailable.';
  end if;

  if group_owner_id = current_user_id then
    raise exception 'The group owner cannot leave the group.';
  end if;

  delete from public.study_group_members
  where group_id = p_group_id
    and user_id = current_user_id;
end;
$$;

revoke all on function public.leave_study_group(uuid)
  from public, anon;

grant execute on function public.leave_study_group(uuid)
  to authenticated;

commit;