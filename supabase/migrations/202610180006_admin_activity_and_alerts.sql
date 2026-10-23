begin;

-- Each admin has a private cursor for new account and admin-action alerts.
create table public.admin_notification_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default transaction_timestamp()
);

insert into public.admin_notification_state(user_id, last_seen_at)
  select user_id, transaction_timestamp() from public.app_administrators
  on conflict (user_id) do nothing;

alter table public.admin_notification_state enable row level security;
revoke all on public.admin_notification_state from public, anon, authenticated;

-- Read-only audit history with basic actor/target identity for administrators.
create function public.get_admin_activity_log(p_page integer default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  page_size constant integer := 25;
  result jsonb;
begin
  if auth.uid() is null or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;
  if p_page is null or p_page not between 1 and 50000 then
    raise exception 'Invalid page number.';
  end if;

  select pg_catalog.jsonb_build_object(
    'page', p_page,
    'pageSize', page_size,
    'totalCount', (select count(*) from public.admin_activity_log),
    'items', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', entry.id,
          'action', entry.action,
          'reason', entry.reason,
          'createdAt', entry.created_at,
          'details', entry.details,
          'actorName', coalesce(
            nullif(trim(actor.raw_user_meta_data ->> 'full_name'), ''),
            nullif(trim(actor.raw_user_meta_data ->> 'name'), ''),
            actor.email,
            'Deleted administrator'
          ),
          'actorEmail', actor.email,
          'targetName', coalesce(
            nullif(trim(target.raw_user_meta_data ->> 'full_name'), ''),
            nullif(trim(target.raw_user_meta_data ->> 'name'), ''),
            target.email,
            case when entry.target_user_id is null then null else 'Deleted account' end
          ),
          'targetEmail', target.email
        ) order by entry.created_at desc, entry.id desc
      )
      from (
        select * from public.admin_activity_log
        order by created_at desc, id desc
        limit page_size offset ((p_page - 1) * page_size)
      ) entry
      left join auth.users actor on actor.id = entry.actor_id
      left join auth.users target on target.id = entry.target_user_id
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Return only account identity and administrative event metadata. Calling with
-- p_mark_read advances this admin's cursor after taking a consistent snapshot.
create function public.get_admin_alerts(p_mark_read boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  cutoff timestamptz := transaction_timestamp();
  previous_seen timestamptz;
  result jsonb;
begin
  if current_user_id is null or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;

  insert into public.admin_notification_state(user_id, last_seen_at)
    values (current_user_id, cutoff)
    on conflict (user_id) do nothing;
  select last_seen_at into previous_seen
    from public.admin_notification_state where user_id = current_user_id for update;

  select pg_catalog.jsonb_build_object(
    'unreadCount', (
      select count(*) from (
        select account.id from auth.users account
        where account.created_at > previous_seen and account.created_at <= cutoff
        union all
        select entry.id from public.admin_activity_log entry
        where entry.created_at > previous_seen and entry.created_at <= cutoff
      ) unread
    ),
    'users', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', recent.id,
        'displayName', coalesce(
          nullif(trim(recent.raw_user_meta_data ->> 'full_name'), ''),
          nullif(trim(recent.raw_user_meta_data ->> 'name'), ''), 'Unnamed user'
        ),
        'email', recent.email,
        'createdAt', recent.created_at
      ) order by recent.created_at desc)
      from (
        select id, raw_user_meta_data, email, created_at from auth.users
        where created_at > previous_seen and created_at <= cutoff
        order by created_at desc limit 5
      ) recent
    ), '[]'::jsonb),
    'activities', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', recent.id, 'action', recent.action,
        'createdAt', recent.created_at, 'reason', recent.reason
      ) order by recent.created_at desc)
      from (
        select id, action, created_at, reason from public.admin_activity_log
        where created_at > previous_seen and created_at <= cutoff
        order by created_at desc limit 5
      ) recent
    ), '[]'::jsonb)
  ) into result;

  if coalesce(p_mark_read, false) then
    update public.admin_notification_state set last_seen_at = cutoff
    where user_id = current_user_id;
  end if;
  return result;
end;
$$;

revoke all on function public.get_admin_activity_log(integer) from public, anon;
revoke all on function public.get_admin_alerts(boolean) from public, anon;
grant execute on function public.get_admin_activity_log(integer) to authenticated;
grant execute on function public.get_admin_alerts(boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
