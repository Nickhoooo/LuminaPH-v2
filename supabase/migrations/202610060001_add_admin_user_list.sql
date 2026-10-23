begin;

-- Return basic account information only, 20 users per page.
create function public.list_admin_users(p_page integer default 1)
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
  if auth.uid() is null
    or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;

  if p_page is null or p_page not between 1 and 50000 then
    raise exception 'Invalid page number.';
  end if;

  select pg_catalog.jsonb_build_object(
    'page', p_page,
    'pageSize', page_size,
    'totalCount', (select count(*) from auth.users),
    'users', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', account.id,
          'displayName', coalesce(
            nullif(trim(account.raw_user_meta_data ->> 'full_name'), ''),
            nullif(trim(account.raw_user_meta_data ->> 'name'), ''),
            'Unnamed user'
          ),
          'email', account.email,
          'createdAt', account.created_at,
          'lastSignInAt', account.last_sign_in_at,
          'emailConfirmed', account.email_confirmed_at is not null,
          'isAdmin', exists (
            select 1
            from public.app_administrators administrator
            where administrator.user_id = account.id
          )
        )
        order by account.created_at desc, account.id
      )
      from (
        select
          id,
          email,
          raw_user_meta_data,
          created_at,
          last_sign_in_at,
          email_confirmed_at
        from auth.users
        order by created_at desc, id
        limit page_size
        offset ((p_page - 1) * page_size)
      ) account
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.list_admin_users(integer)
  from public, anon, authenticated;

grant execute on function public.list_admin_users(integer)
  to authenticated;

commit;