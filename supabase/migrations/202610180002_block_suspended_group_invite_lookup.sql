begin;

-- The invite lookup is SECURITY DEFINER, so normal table RLS does not protect
-- it. Check the caller's account status before returning an owner's invite.
create or replace function public.get_study_group_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_invite_code text;
begin
  if current_user_id is null then
    raise exception 'Please log in to view the invite code.';
  end if;

  perform public.require_current_account_active();

  if not exists (
    select 1
    from public.study_groups
    where id = p_group_id
      and owner_id = current_user_id
  ) then
    raise exception 'Group unavailable or you are not its owner.';
  end if;

  select invite_code into saved_invite_code
  from public.study_group_invites
  where group_id = p_group_id;

  if not found then
    raise exception 'Invite code unavailable.';
  end if;

  return saved_invite_code;
end;
$$;

revoke all on function public.get_study_group_invite(uuid)
  from public, anon;
grant execute on function public.get_study_group_invite(uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
