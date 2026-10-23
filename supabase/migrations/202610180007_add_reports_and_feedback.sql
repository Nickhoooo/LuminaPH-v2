begin;

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug', 'ai_quality', 'account', 'group', 'suggestion', 'other')),
  title text not null check (char_length(trim(title)) between 4 and 120),
  message text not null check (char_length(trim(message)) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'in_review', 'resolved')),
  admin_response text check (admin_response is null or char_length(trim(admin_response)) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create index user_reports_date_idx on public.user_reports(created_at desc, id desc);
create index user_reports_user_date_idx on public.user_reports(user_id, created_at desc);
create index user_reports_status_date_idx on public.user_reports(status, created_at desc);

alter table public.user_reports enable row level security;
revoke all on public.user_reports from public, anon, authenticated;
grant select on public.user_reports to authenticated;

create policy "Users read their own reports and admins review submissions"
  on public.user_reports for select to authenticated
  using (user_id = (select auth.uid()) or public.is_app_administrator());

create function public.submit_user_report(
  p_request_id uuid, p_category text, p_title text, p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_title text := trim(coalesce(p_title, ''));
  clean_message text := trim(coalesce(p_message, ''));
  existing_report public.user_reports;
  new_report_id uuid;
begin
  if current_user_id is null then raise exception 'Please log in to send feedback.'; end if;
  if public.is_current_account_suspended() then raise exception 'This account cannot submit feedback right now.'; end if;
  if p_request_id is null then raise exception 'A request ID is required.'; end if;
  if p_category is null or p_category not in ('bug', 'ai_quality', 'account', 'group', 'suggestion', 'other') then
    raise exception 'Choose a valid feedback category.';
  end if;
  if char_length(clean_title) not between 4 and 120 then
    raise exception 'The title must contain 4 to 120 characters.';
  end if;
  if char_length(clean_message) not between 10 and 4000 then
    raise exception 'The details must contain 10 to 4,000 characters.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 181007));

  select * into existing_report from public.user_reports
  where user_id = current_user_id and request_id = p_request_id;
  if found then
    if existing_report.category is distinct from p_category
      or existing_report.title is distinct from clean_title
      or existing_report.message is distinct from clean_message then
      raise exception 'This request ID was already used for different feedback.';
    end if;
    return existing_report.id;
  end if;

  if exists (
    select 1 from public.user_reports
    where user_id = current_user_id and created_at > now() - interval '60 seconds'
  ) then raise exception 'Please wait a minute before sending another report.'; end if;
  if (select count(*) from public.user_reports
    where user_id = current_user_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'You have reached the report limit for today.';
  end if;

  insert into public.user_reports(request_id, user_id, category, title, message)
  values (p_request_id, current_user_id, p_category, clean_title, clean_message)
  returning id into new_report_id;
  return new_report_id;
end;
$$;

-- Admins may see user-submitted content and identity, but only through this RPC.
create function public.get_admin_reports(p_page integer default 1, p_status text default 'all')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  page_size constant integer := 20;
  result jsonb;
begin
  if auth.uid() is null or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;
  if p_page is null or p_page not between 1 and 50000 then raise exception 'Invalid page number.'; end if;
  if coalesce(p_status, 'all') not in ('all', 'new', 'in_review', 'resolved') then
    raise exception 'Choose a valid report status.';
  end if;

  select pg_catalog.jsonb_build_object(
    'page', p_page,
    'pageSize', page_size,
    'totalCount', (select count(*) from public.user_reports report
      where coalesce(p_status, 'all') = 'all' or report.status = p_status),
    'items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', report.id, 'userId', report.user_id, 'category', report.category,
        'title', report.title, 'message', report.message, 'status', report.status,
        'adminResponse', report.admin_response, 'createdAt', report.created_at,
        'updatedAt', report.updated_at,
        'userName', coalesce(
          nullif(trim(account.raw_user_meta_data ->> 'full_name'), ''),
          nullif(trim(account.raw_user_meta_data ->> 'name'), ''), 'Unnamed user'
        ),
        'userEmail', account.email
      ) order by report.created_at desc, report.id desc)
      from (
        select * from public.user_reports report
        where coalesce(p_status, 'all') = 'all' or report.status = p_status
        order by created_at desc, id desc
        limit page_size offset ((p_page - 1) * page_size)
      ) report
      join auth.users account on account.id = report.user_id
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Report status updates also notify the submitting user and create an audit entry.
alter table public.admin_activity_log drop constraint if exists admin_activity_log_action_check;
alter table public.admin_activity_log add constraint admin_activity_log_action_check
  check (action in ('ban_user', 'unban_user', 'delete_user', 'set_usage', 'grant_admin', 'revoke_admin', 'update_report'));

create function public.update_user_report(
  p_report_id uuid, p_status text, p_response text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_report public.user_reports;
  clean_response text := nullif(trim(coalesce(p_response, '')), '');
begin
  if current_user_id is null or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;
  if public.is_current_account_suspended() then raise exception 'Suspended administrators cannot review reports.'; end if;
  if p_report_id is null then raise exception 'A report is required.'; end if;
  if p_status is null or p_status not in ('new', 'in_review', 'resolved') then raise exception 'Choose a valid report status.'; end if;
  if clean_response is not null and char_length(clean_response) > 2000 then
    raise exception 'A response can contain at most 2,000 characters.';
  end if;

  select * into saved_report from public.user_reports where id = p_report_id for update;
  if not found then raise exception 'Report unavailable.'; end if;
  if saved_report.status = p_status and saved_report.admin_response is not distinct from clean_response then
    return;
  end if;

  update public.user_reports set status = p_status, admin_response = clean_response, updated_at = now()
  where id = p_report_id;

  insert into public.admin_activity_log(actor_id, target_user_id, action, reason, details)
  values (
    current_user_id, saved_report.user_id, 'update_report',
    'Report status changed to ' || p_status,
    pg_catalog.jsonb_build_object('reportId', p_report_id, 'category', saved_report.category, 'status', p_status)
  );

  insert into public.notifications(user_id, kind, title, message, href, event_key)
  select saved_report.user_id, 'admin', 'Your report was updated',
    case when clean_response is null
      then 'Your report status is now ' || replace(p_status, '_', ' ') || '.'
      else left('An administrator replied: ' || clean_response, 2000) end,
    '/feedback', 'report:' || p_report_id::text || ':' || p_status || ':' || extract(epoch from now())::text
  from public.user_settings settings
  where settings.user_id = saved_report.user_id
    and coalesce(settings.admin_notifications, true)
  on conflict (user_id, event_key) do nothing;

  -- Accounts without a settings row still receive the status notice.
  if not exists (select 1 from public.user_settings where user_id = saved_report.user_id) then
    insert into public.notifications(user_id, kind, title, message, href, event_key)
    values (saved_report.user_id, 'admin', 'Your report was updated',
      case when clean_response is null
        then 'Your report status is now ' || replace(p_status, '_', ' ') || '.'
        else left('An administrator replied: ' || clean_response, 2000) end,
      '/feedback', 'report:' || p_report_id::text || ':' || p_status || ':' || extract(epoch from now())::text)
    on conflict (user_id, event_key) do nothing;
  end if;
end;
$$;

-- Extend the admin bell's unread events with user-submitted reports.
create or replace function public.get_admin_alerts(p_mark_read boolean default false)
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
    values (current_user_id, cutoff) on conflict (user_id) do nothing;
  select last_seen_at into previous_seen from public.admin_notification_state
    where user_id = current_user_id for update;

  select pg_catalog.jsonb_build_object(
    'unreadCount', (select count(*) from (
      select account.id from auth.users account where account.created_at > previous_seen and account.created_at <= cutoff
      union all select entry.id from public.admin_activity_log entry where entry.created_at > previous_seen and entry.created_at <= cutoff
      union all select report.id from public.user_reports report where report.created_at > previous_seen and report.created_at <= cutoff
    ) unread),
    'users', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', recent.id, 'displayName', coalesce(
          nullif(trim(recent.raw_user_meta_data ->> 'full_name'), ''),
          nullif(trim(recent.raw_user_meta_data ->> 'name'), ''), 'Unnamed user'
        ), 'email', recent.email, 'createdAt', recent.created_at
      ) order by recent.created_at desc)
      from (select id, raw_user_meta_data, email, created_at from auth.users
        where created_at > previous_seen and created_at <= cutoff
        order by created_at desc limit 5) recent
    ), '[]'::jsonb),
    'activities', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', recent.id, 'action', recent.action, 'createdAt', recent.created_at, 'reason', recent.reason
      ) order by recent.created_at desc)
      from (select id, action, created_at, reason from public.admin_activity_log
        where created_at > previous_seen and created_at <= cutoff
        order by created_at desc limit 5) recent
    ), '[]'::jsonb),
    'reports', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', recent.id, 'title', recent.title, 'category', recent.category,
        'createdAt', recent.created_at
      ) order by recent.created_at desc)
      from (select id, title, category, created_at from public.user_reports
        where created_at > previous_seen and created_at <= cutoff
        order by created_at desc limit 5) recent
    ), '[]'::jsonb)
  ) into result;

  if coalesce(p_mark_read, false) then
    update public.admin_notification_state set last_seen_at = cutoff where user_id = current_user_id;
  end if;
  return result;
end;
$$;

revoke all on function public.submit_user_report(uuid, text, text, text) from public, anon;
revoke all on function public.get_admin_reports(integer, text) from public, anon;
revoke all on function public.update_user_report(uuid, text, text) from public, anon;
revoke all on function public.get_admin_alerts(boolean) from public, anon;
grant execute on function public.submit_user_report(uuid, text, text, text) to authenticated;
grant execute on function public.get_admin_reports(integer, text) to authenticated;
grant execute on function public.update_user_report(uuid, text, text) to authenticated;
grant execute on function public.get_admin_alerts(boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
