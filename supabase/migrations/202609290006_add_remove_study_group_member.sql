begin;

-- Only the group owner can remove another member.
create function public.remove_study_group_member(
  p_group_id uuid,
  p_member_id uuid
)
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
    raise exception 'Please log in before removing a member.';
  end if;

  if p_group_id is null or p_member_id is null then
    raise exception 'A group and member are required.';
  end if;

  -- Keep ownership unchanged during this operation.
  select owner_id into group_owner_id
  from public.study_groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'Group unavailable.';
  end if;

  if group_owner_id <> current_user_id then
    raise exception 'Only the group owner can remove members.';
  end if;

  if p_member_id = group_owner_id then
    raise exception 'The group owner cannot be removed.';
  end if;

  delete from public.study_group_members
  where group_id = p_group_id
    and user_id = p_member_id;
end;
$$;

revoke all on function public.remove_study_group_member(uuid, uuid)
  from public, anon;

grant execute on function public.remove_study_group_member(uuid, uuid)
  to authenticated;

commit;