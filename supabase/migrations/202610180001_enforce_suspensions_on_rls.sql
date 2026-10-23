begin;

-- RLS filters direct table access, including active sessions that were signed
-- in before the account was suspended.
do $$
declare
  public_table record;
  policy_exists boolean;
begin
  for public_table in
    select relation.relname
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace schema_info
      on schema_info.oid = relation.relnamespace
    where schema_info.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
  loop
    select exists (
      select 1
      from pg_catalog.pg_policy policy_info
      join pg_catalog.pg_class relation
        on relation.oid = policy_info.polrelid
      join pg_catalog.pg_namespace schema_info
        on schema_info.oid = relation.relnamespace
      where schema_info.nspname = 'public'
        and relation.relname = public_table.relname
        and policy_info.polname = 'Block suspended accounts'
    ) into policy_exists;

    if not policy_exists then
      execute pg_catalog.format(
        'create policy %I on public.%I as restrictive for all to authenticated using (not public.is_current_account_suspended()) with check (not public.is_current_account_suspended())',
        'Block suspended accounts',
        public_table.relname
      );
    end if;
  end loop;
end;
$$;

-- Call this from SECURITY DEFINER RPCs before they read or write user data.
create function public.require_current_account_active()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Please log in.';
  end if;

  if public.is_current_account_suspended() then
    raise exception 'This account cannot access LuminaPH right now.';
  end if;
end;
$$;

revoke all on function public.require_current_account_active()
  from public, anon, authenticated;

-- Admin RPCs that use these helpers will also reject suspended administrators.
create or replace function public.is_app_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not public.is_current_account_suspended()
    and exists (
      select 1
      from public.app_administrators
      where user_id = auth.uid()
    );
$$;

create or replace function public.is_super_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not public.is_current_account_suspended()
    and exists (
      select 1
      from public.app_administrators
      where user_id = auth.uid()
        and role = 'super_admin'
    );
$$;

create or replace function public.is_study_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not public.is_current_account_suspended()
    and exists (
      select 1
      from public.study_group_members
      where group_id = p_group_id
        and user_id = auth.uid()
    );
$$;

revoke all on function public.is_app_administrator()
  from public, anon, authenticated;
grant execute on function public.is_app_administrator()
  to authenticated;

revoke all on function public.is_super_administrator()
  from public, anon, authenticated;
grant execute on function public.is_super_administrator()
  to authenticated;

revoke all on function public.is_study_group_member(uuid)
  from public, anon;
grant execute on function public.is_study_group_member(uuid)
  to authenticated;

-- Table writes through either direct PostgREST access or a SECURITY DEFINER
-- function run this trigger. auth.uid() stays the signed-in caller's identity.
create function public.block_suspended_account_writes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    perform public.require_current_account_active();
  end if;

  return null;
end;
$$;

revoke all on function public.block_suspended_account_writes()
  from public, anon, authenticated;

do $$
declare
  public_table record;
  trigger_exists boolean;
begin
  for public_table in
    select relation.relname
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace schema_info
      on schema_info.oid = relation.relnamespace
    where schema_info.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
  loop
    select exists (
      select 1
      from pg_catalog.pg_trigger trigger_info
      join pg_catalog.pg_class relation
        on relation.oid = trigger_info.tgrelid
      join pg_catalog.pg_namespace schema_info
        on schema_info.oid = relation.relnamespace
      where schema_info.nspname = 'public'
        and relation.relname = public_table.relname
        and trigger_info.tgname = 'block_suspended_account_writes'
        and not trigger_info.tgisinternal
    ) into trigger_exists;

    if not trigger_exists then
      execute pg_catalog.format(
        'create trigger %I before insert or update or delete on public.%I for each statement execute function public.block_suspended_account_writes()',
        'block_suspended_account_writes',
        public_table.relname
      );
    end if;
  end loop;
end;
$$;

-- Profile and group images live in Supabase Storage, outside the public schema.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace schema_info on schema_info.oid = relation.relnamespace
    where schema_info.nspname = 'storage'
      and relation.relname = 'objects'
      and relation.relrowsecurity
  ) and not exists (
    select 1 from pg_catalog.pg_policy policy_info
    join pg_catalog.pg_class relation on relation.oid = policy_info.polrelid
    join pg_catalog.pg_namespace schema_info on schema_info.oid = relation.relnamespace
    where schema_info.nspname = 'storage'
      and relation.relname = 'objects'
      and policy_info.polname = 'Block suspended account storage access'
  ) then
    create policy "Block suspended account storage access"
      on storage.objects as restrictive for all to authenticated
      using (not public.is_current_account_suspended())
      with check (not public.is_current_account_suspended());
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
