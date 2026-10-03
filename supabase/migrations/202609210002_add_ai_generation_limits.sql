begin;

create table public.ai_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_attempts_user_created_idx
  on public.ai_generation_attempts(user_id, created_at);

create index ai_attempts_created_idx
  on public.ai_generation_attempts(created_at);

alter table public.ai_generation_attempts
  enable row level security;

revoke all on table public.ai_generation_attempts
  from public, anon, authenticated;

create function public.reserve_ai_generation()
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

  if current_user_id is null then
    return 'unauthorized';
  end if;

  -- Serialize allowance checks so simultaneous requests cannot
  -- both claim the final available slot.
  perform pg_catalog.pg_advisory_xact_lock(2109202601::bigint);

  checked_at := pg_catalog.clock_timestamp();

  if exists (
    select 1
    from public.ai_generation_attempts
    where user_id = current_user_id
      and created_at > checked_at - interval '60 seconds'
  ) then
    return 'cooldown';
  end if;

  select count(*)
  into user_attempts
  from public.ai_generation_attempts
  where user_id = current_user_id
    and created_at > checked_at - interval '24 hours';

  if user_attempts >= 5 then
    return 'user_limit';
  end if;

  select count(*)
  into app_attempts
  from public.ai_generation_attempts
  where created_at > checked_at - interval '24 hours';

  if app_attempts >= 50 then
    return 'app_limit';
  end if;

  insert into public.ai_generation_attempts (user_id, created_at)
  values (current_user_id, checked_at);

  return 'allowed';
end;
$$;

revoke execute on function public.reserve_ai_generation()
  from public, anon, authenticated;

grant execute on function public.reserve_ai_generation()
  to authenticated;

commit;
