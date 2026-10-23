begin;

-- Add a safe role filter while keeping name/email search and pagination.
drop function public.list_admin_users(integer, text);

create function public.list_admin_users(
  p_page integer default 1,
  p_search text default '',
  p_role text default 'all'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  page_size constant integer := 20;
  search_text text := lower(trim(coalesce(p_search, '')));
  role_filter text := coalesce(p_role, 'all');
  result jsonb;
begin
  if auth.uid() is null
    or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;

  if p_page is null or p_page not between 1 and 50000 then
    raise exception 'Invalid page number.';
  end if;

  if char_length(search_text) > 120 then
    raise exception 'Search must contain at most 120 characters.';
  end if;

  if role_filter not in ('all', 'admins', 'users') then
    raise exception 'Choose all accounts, admins, or users.';
  end if;

  with matching_users as (
    select
      account.id,
      coalesce(
        nullif(trim(account.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(account.raw_user_meta_data ->> 'name'), ''),
        'Unnamed user'
      ) as display_name,
      account.email,
      account.created_at,
      account.last_sign_in_at,
      account.email_confirmed_at,
      exists (
        select 1
        from public.app_administrators administrator
        where administrator.user_id = account.id
      ) as is_admin
    from auth.users account
  ),
  filtered_users as (
    select *
    from matching_users
    where (search_text = ''
      or strpos(lower(display_name), search_text) > 0
      or strpos(lower(coalesce(email, '')), search_text) > 0)
      and (role_filter = 'all'
        or (role_filter = 'admins' and is_admin)
        or (role_filter = 'users' and not is_admin))
  ),
  page_users as (
    select *
    from filtered_users
    order by created_at desc, id
    limit page_size
    offset ((p_page - 1) * page_size)
  )
  select pg_catalog.jsonb_build_object(
    'page', p_page,
    'pageSize', page_size,
    'totalCount', (select count(*) from filtered_users),
    'users', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', account.id,
          'displayName', account.display_name,
          'email', account.email,
          'createdAt', account.created_at,
          'lastSignInAt', account.last_sign_in_at,
          'emailConfirmed', account.email_confirmed_at is not null,
          'isAdmin', account.is_admin
        )
        order by account.created_at desc, account.id
      )
      from page_users account
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.list_admin_users(integer, text, text)
  from public, anon, authenticated;
grant execute on function public.list_admin_users(integer, text, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
