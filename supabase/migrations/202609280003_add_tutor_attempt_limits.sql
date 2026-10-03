begin;

-- Chat attempts are separate from study-guide/quiz/lesson generation attempts.
-- Failed AI requests still count after an attempt has been reserved.
create table public.tutor_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index tutor_attempts_user_date_idx
  on public.tutor_generation_attempts(user_id, created_at);
create index tutor_attempts_date_idx
  on public.tutor_generation_attempts(created_at);

alter table public.tutor_generation_attempts enable row level security;
revoke all on public.tutor_generation_attempts from public, anon, authenticated;

create function public.reserve_tutor_generation(p_conversation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  checked_at timestamptz;
  user_attempts bigint;
  app_attempts bigint;
begin
  if current_user_id is null then
    return 'unauthorized';
  end if;

  -- Verify ownership and the guide before consuming any allowance.
  if not exists (
    select 1
    from public.tutor_conversations c
    join public.study_sets s on s.id = c.study_set_id
    where c.id = p_conversation_id
      and c.user_id = current_user_id
      and s.user_id = current_user_id
      and s.material_type = 'study_guide'
  ) then
    return 'unavailable';
  end if;

  if exists (
    select 1 from public.ai_generation_developers
    where user_id = current_user_id
  ) then
    insert into public.tutor_generation_attempts(user_id, created_at)
      values (current_user_id, pg_catalog.clock_timestamp());
    return 'allowed';
  end if;

  -- Use a separate lock from material generation. Counts and reservation
  -- stay atomic when several ordinary users send messages concurrently.
  perform pg_catalog.pg_advisory_xact_lock(2809202603::bigint);
  checked_at := pg_catalog.clock_timestamp();

  if exists (
    select 1 from public.tutor_generation_attempts
    where user_id = current_user_id
      and created_at > checked_at - interval '10 seconds'
  ) then
    return 'cooldown';
  end if;

  select count(*) into user_attempts
    from public.tutor_generation_attempts
    where user_id = current_user_id
      and created_at > checked_at - interval '24 hours';
  if user_attempts >= 20 then
    return 'user_limit';
  end if;

  select count(*) into app_attempts
    from public.tutor_generation_attempts a
    where a.created_at > checked_at - interval '24 hours'
      and not exists (
        select 1 from public.ai_generation_developers d
        where d.user_id = a.user_id
      );
  if app_attempts >= 200 then
    return 'app_limit';
  end if;

  insert into public.tutor_generation_attempts(user_id, created_at)
    values (current_user_id, checked_at);
  return 'allowed';
end;
$$;

revoke all on function public.reserve_tutor_generation(uuid) from public, anon;
grant execute on function public.reserve_tutor_generation(uuid) to authenticated;

commit;
