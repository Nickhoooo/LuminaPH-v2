begin;

-- Return basic details for one account, accessible only to admins.
create function public.get_admin_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_details jsonb;
begin
  if auth.uid() is null
    or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;

  if p_user_id is null then
    raise exception 'A user ID is required.';
  end if;

  select pg_catalog.jsonb_build_object(
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
  ) into account_details
  from auth.users account
  where account.id = p_user_id;

  return account_details;
end;
$$;

revoke all on function public.get_admin_user(uuid)
  from public, anon, authenticated;

grant execute on function public.get_admin_user(uuid)
  to authenticated;

commit;