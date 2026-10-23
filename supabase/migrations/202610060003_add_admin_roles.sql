begin;

alter table public.app_administrators
  add column role text not null default 'admin'
  constraint app_administrators_role_check
  check (role in ('admin', 'super_admin'));

create function public.is_super_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.app_administrators
      where user_id = auth.uid()
        and role = 'super_admin'
    );
$$;

revoke all on function public.is_super_administrator()
  from public, anon, authenticated;

grant execute on function public.is_super_administrator()
  to authenticated;

commit;