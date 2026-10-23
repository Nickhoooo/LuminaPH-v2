begin;

create table public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),

  actor_id uuid references auth.users(id) on delete set null,

  target_user_id uuid,

  action text not null check (
    action in (
      'ban_user',
      'unban_user',
      'delete_user',
      'set_usage',
      'grant_admin',
      'revoke_admin'
    )
  ),

  reason text not null
    check (char_length(trim(reason)) between 1 and 1000),

  created_at timestamptz not null default now()
);

create index admin_activity_log_date_idx
  on public.admin_activity_log(created_at desc, id desc);

alter table public.admin_activity_log enable row level security;

revoke all on public.admin_activity_log
  from public, anon, authenticated;

grant select on public.admin_activity_log to authenticated;

create policy "Administrators can read activity history"
  on public.admin_activity_log
  for select
  to authenticated
  using (public.is_app_administrator());

create function public.require_admin_management_permission(
  p_target_user_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  actor_role text;
  target_role text;
begin
  if current_user_id is null then
    raise exception 'Please log in.';
  end if;

  select role into actor_role
  from public.app_administrators
  where user_id = current_user_id;

  if actor_role is null then
    raise exception 'Administrator access required.';
  end if;

  if p_action is null or p_action not in (
    'ban_user',
    'unban_user',
    'delete_user',
    'set_usage',
    'grant_admin',
    'revoke_admin'
  ) then
    raise exception 'Unsupported management action.';
  end if;

  if p_target_user_id is null then
    raise exception 'A target account is required.';
  end if;

  if not exists (
    select 1 from auth.users
    where id = p_target_user_id
  ) then
    raise exception 'Account unavailable.';
  end if;

  select role into target_role
  from public.app_administrators
  where user_id = p_target_user_id;

  if target_role = 'super_admin' then
    raise exception 'Super Admin accounts are protected.';
  end if;

  if current_user_id = p_target_user_id then
    raise exception 'You cannot manage your own account here.';
  end if;

  if actor_role = 'admin' then
    if target_role is not null then
      raise exception 'Regular admins cannot manage other admins.';
    end if;

    if p_action not in ('ban_user', 'unban_user') then
      raise exception 'Super Admin access required for this action.';
    end if;
  end if;
end;
$$;

revoke all on function public.require_admin_management_permission(uuid, text)
  from public, anon, authenticated;

commit;  