begin;

-- Only database administrators can manage this list. Never use editable
-- user_metadata or a browser-provided email to grant generation privileges.
create table public.ai_generation_developers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.ai_generation_developers enable row level security;
revoke all on public.ai_generation_developers from public, anon, authenticated;

-- Resolve the existing, confirmed account once and store its immutable user ID.
-- Recreating an account with the same email will not inherit this access.
do $$
declare
  developer_id uuid;
begin
  select id into developer_id from auth.users
    where lower(email) = 'dumayasnick@gmail.com' and email_confirmed_at is not null;
  if developer_id is null then
    raise exception 'The requested confirmed developer account was not found. No changes applied.';
  end if;
  insert into public.ai_generation_developers(user_id) values (developer_id);
end;
$$;

create or replace function public.reserve_ai_generation()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  checked_at timestamptz;
  user_attempts bigint;
  app_attempts bigint;
begin
  current_user_id := auth.uid();
  if current_user_id is null then return 'unauthorized'; end if;

  -- Developers bypass LuminaPH limits, but calls still use the existing
  -- provider account and its free-tier limits. Keep an audit of each attempt.
  if exists (select 1 from public.ai_generation_developers where user_id = current_user_id) then
    insert into public.ai_generation_attempts(user_id, created_at)
      values (current_user_id, pg_catalog.clock_timestamp());
    return 'allowed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(2109202601::bigint);
  checked_at := pg_catalog.clock_timestamp();

  if exists (
    select 1 from public.ai_generation_attempts
    where user_id = current_user_id and created_at > checked_at - interval '60 seconds'
  ) then return 'cooldown'; end if;

  select count(*) into user_attempts from public.ai_generation_attempts
    where user_id = current_user_id and created_at > checked_at - interval '24 hours';
  if user_attempts >= 5 then return 'user_limit'; end if;

  -- Developer testing must not consume the normal users' app allowance.
  select count(*) into app_attempts from public.ai_generation_attempts a
    where a.created_at > checked_at - interval '24 hours'
    and not exists (select 1 from public.ai_generation_developers d where d.user_id = a.user_id);
  if app_attempts >= 50 then return 'app_limit'; end if;

  insert into public.ai_generation_attempts(user_id, created_at) values (current_user_id, checked_at);
  return 'allowed';
end;
$$;

revoke execute on function public.reserve_ai_generation() from public, anon, authenticated;
grant execute on function public.reserve_ai_generation() to authenticated;

commit;
