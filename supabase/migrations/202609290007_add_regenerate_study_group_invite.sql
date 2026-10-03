begin;

create function public.regenerate_study_group_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  group_owner_id uuid;
  previous_code text;
  replacement_code text;
  attempt_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Please log in to change the invite code.';
  end if;

  -- Serialize changes and keep ownership stable during the operation.
  select owner_id into group_owner_id
  from public.study_groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'Group unavailable.';
  end if;

  if group_owner_id <> current_user_id then
    raise exception 'Only the group owner can change the invite code.';
  end if;

  select invite_code into previous_code
  from public.study_group_invites
  where group_id = p_group_id
  for update;

  if not found then
    raise exception 'Invite code unavailable.';
  end if;

  loop
    attempt_count := attempt_count + 1;

    if attempt_count > 20 then
      raise exception 'Could not generate a unique replacement code.';
    end if;

    replacement_code := public.generate_study_group_invite_code();

    -- The new code must differ from the current code.
    if replacement_code = previous_code then
      continue;
    end if;

    begin
      update public.study_group_invites
      set invite_code = replacement_code
      where group_id = p_group_id;

      return replacement_code;
    exception
      when unique_violation then
        -- Another group already uses this code. Try another.
        continue;
    end;
  end loop;
end;
$$;

revoke all on function public.regenerate_study_group_invite(uuid)
  from public, anon;

grant execute on function public.regenerate_study_group_invite(uuid)
  to authenticated;

commit;