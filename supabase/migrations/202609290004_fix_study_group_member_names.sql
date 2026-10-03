begin;

-- Support current and legacy display names without exposing email addresses.
-- Missing names receive a stable member label, not an invented personal name.
create or replace function public.list_study_group_members(
  p_group_id uuid,
  p_page integer default 1
)
returns table (
  user_id uuid,
  display_name text,
  is_owner boolean,
  joined_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Please log in to view group members.';
  end if;

  if not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;

  if p_page is null or p_page not between 1 and 50000 then
    raise exception 'Invalid page number.';
  end if;

  return query
  select
    member.user_id,

    coalesce(
      case
        when pg_catalog.jsonb_typeof(account.raw_user_meta_data -> 'full_name') = 'string'
        then nullif(left(trim(account.raw_user_meta_data ->> 'full_name'), 80), '')
      end,
      case
        when pg_catalog.jsonb_typeof(account.raw_user_meta_data -> 'name') = 'string'
        then nullif(left(trim(account.raw_user_meta_data ->> 'name'), 80), '')
      end,
      'Unnamed member ' || left(member.user_id::text, 8)
    ) as display_name,

    member.user_id = study_group.owner_id as is_owner,
    member.joined_at,
    count(*) over () as total_count

  from public.study_group_members as member

  join public.study_groups as study_group
    on study_group.id = member.group_id

  join auth.users as account
    on account.id = member.user_id

  where member.group_id = p_group_id

  order by
    (member.user_id = study_group.owner_id) desc,
    member.joined_at asc,
    member.user_id asc

  limit 20
  offset ((p_page - 1) * 20);
end;
$$;

revoke all on function public.list_study_group_members(uuid, integer)
  from public, anon;

grant execute on function public.list_study_group_members(uuid, integer)
  to authenticated;

commit;