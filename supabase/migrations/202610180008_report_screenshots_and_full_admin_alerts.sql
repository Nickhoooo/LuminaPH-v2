begin;

alter table public.user_reports add column screenshot_path text;

-- A private bucket. A report has one fixed screenshot object path so retries
-- cannot create a pile of duplicate uploads for the same report.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-report-screenshots', 'user-report-screenshots', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload screenshots for their own reports"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-report-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.filename(name) = 'screenshot'
    and exists (
      select 1 from public.user_reports report
      where report.id::text = (storage.foldername(name))[2]
        and report.user_id = (select auth.uid())
        and report.screenshot_path is null
    )
  );

-- A reporter can see their own image; admins can view any submitted image.
create policy "Reporters and admins can view report screenshots"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'user-report-screenshots'
    and (
      public.is_app_administrator()
      or exists (
        select 1 from public.user_reports report
        where report.screenshot_path = name and report.user_id = (select auth.uid())
      )
    )
  );

-- Permit cleanup only for an upload that has not been attached to a report.
create policy "Reporters can clean up unattached screenshots"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-report-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.user_reports report
      where report.screenshot_path = name and report.user_id = (select auth.uid())
    )
  );

create function public.attach_user_report_screenshot(p_report_id uuid, p_screenshot_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_report public.user_reports;
  expected_path text;
begin
  if current_user_id is null then raise exception 'Please log in.'; end if;
  if p_report_id is null then raise exception 'A report is required.'; end if;
  expected_path := current_user_id::text || '/' || p_report_id::text || '/screenshot';
  if p_screenshot_path is distinct from expected_path then
    raise exception 'This screenshot does not belong to your report.';
  end if;

  select * into saved_report from public.user_reports
  where id = p_report_id and user_id = current_user_id for update;
  if not found then raise exception 'Report unavailable.'; end if;
  if saved_report.screenshot_path is not null then
    if saved_report.screenshot_path = expected_path then return; end if;
    raise exception 'A screenshot is already attached to this report.';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'user-report-screenshots' and name = expected_path
  ) then raise exception 'Screenshot upload was not found.'; end if;

  update public.user_reports set screenshot_path = expected_path, updated_at = now()
  where id = p_report_id;
end;
$$;

-- Return a short-lived path only to the admin server, which creates a signed
-- URL for inline preview. No screenshot links are exposed to regular users.
create or replace function public.get_admin_reports(p_page integer default 1, p_status text default 'all')
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
        'adminResponse', report.admin_response, 'screenshotPath', report.screenshot_path,
        'createdAt', report.created_at, 'updatedAt', report.updated_at,
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

-- Include every unread event since the admin's previous visit. The dropdown is
-- scrollable, so do not silently hide older items behind a fixed five-item cap.
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
      ) order by recent.created_at desc, recent.id desc)
      from auth.users recent
      where recent.created_at > previous_seen and recent.created_at <= cutoff
    ), '[]'::jsonb),
    'activities', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', recent.id, 'action', recent.action, 'createdAt', recent.created_at, 'reason', recent.reason
      ) order by recent.created_at desc, recent.id desc)
      from public.admin_activity_log recent
      where recent.created_at > previous_seen and recent.created_at <= cutoff
    ), '[]'::jsonb),
    'reports', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', recent.id, 'title', recent.title, 'category', recent.category,
        'createdAt', recent.created_at
      ) order by recent.created_at desc, recent.id desc)
      from public.user_reports recent
      where recent.created_at > previous_seen and recent.created_at <= cutoff
    ), '[]'::jsonb)
  ) into result;

  if coalesce(p_mark_read, false) then
    update public.admin_notification_state set last_seen_at = cutoff where user_id = current_user_id;
  end if;
  return result;
end;
$$;

revoke all on function public.attach_user_report_screenshot(uuid, text) from public, anon;
revoke all on function public.get_admin_reports(integer, text) from public, anon;
revoke all on function public.get_admin_alerts(boolean) from public, anon;
grant execute on function public.attach_user_report_screenshot(uuid, text) to authenticated;
grant execute on function public.get_admin_reports(integer, text) to authenticated;
grant execute on function public.get_admin_alerts(boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
