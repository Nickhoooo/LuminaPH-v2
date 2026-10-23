begin;

-- Processed screenshots are removed through the Storage API after the report
-- rows have been deleted. Keep that action available to administrators only.
create policy "Administrators delete processed report screenshots"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-report-screenshots'
    and public.is_app_administrator()
  );

alter table public.admin_activity_log
  drop constraint if exists admin_activity_log_action_check;
alter table public.admin_activity_log
  add constraint admin_activity_log_action_check
  check (action in (
    'ban_user', 'unban_user', 'delete_user', 'set_usage',
    'grant_admin', 'revoke_admin', 'update_report', 'delete_report'
  ));

-- Only resolved reports may be permanently deleted. Return attached paths so
-- the server action can remove their image objects through the Storage API.
create function public.delete_resolved_user_reports(p_report_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  requested_count integer;
  available_count integer;
  deleted_count integer;
  screenshot_paths jsonb;
begin
  if current_user_id is null or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot delete reports.';
  end if;
  if p_report_ids is null or cardinality(p_report_ids) not between 1 and 20 then
    raise exception 'Select between 1 and 20 resolved reports.';
  end if;
  if array_position(p_report_ids, null::uuid) is not null then
    raise exception 'One or more selected reports are invalid.';
  end if;

  select count(distinct report_id) into requested_count
  from unnest(p_report_ids) as selected(report_id);
  if requested_count <> cardinality(p_report_ids) then
    raise exception 'A report was selected more than once.';
  end if;

  perform 1 from public.user_reports
  where id = any(p_report_ids)
  order by id
  for update;

  select count(*) into available_count
  from public.user_reports
  where id = any(p_report_ids) and status = 'resolved';
  if available_count <> requested_count then
    raise exception 'Only reports marked resolved can be deleted. Refresh and try again.';
  end if;

  insert into public.admin_activity_log(actor_id, target_user_id, action, reason, details)
  select current_user_id, report.user_id, 'delete_report',
    'Deleted resolved report: ' || report.title,
    pg_catalog.jsonb_build_object(
      'reportId', report.id,
      'category', report.category,
      'title', report.title
    )
  from public.user_reports report
  where report.id = any(p_report_ids);

  with deleted_reports as (
    delete from public.user_reports
    where id = any(p_report_ids) and status = 'resolved'
    returning screenshot_path
  )
  select count(*), coalesce(
    pg_catalog.jsonb_agg(screenshot_path) filter (where screenshot_path is not null),
    '[]'::jsonb
  )
  into deleted_count, screenshot_paths
  from deleted_reports;

  return pg_catalog.jsonb_build_object(
    'deletedCount', deleted_count,
    'screenshotPaths', screenshot_paths
  );
end;
$$;

revoke all on function public.delete_resolved_user_reports(uuid[])
  from public, anon;
grant execute on function public.delete_resolved_user_reports(uuid[])
  to authenticated;

notify pgrst, 'reload schema';
commit;
