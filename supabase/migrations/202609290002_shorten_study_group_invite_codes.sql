begin;

-- 1. Generate six random uppercase letters.
create function public.generate_study_group_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  generated_code text := '';
  random_byte integer;
begin
  while char_length(generated_code) < 6
  loop
    random_byte := pg_catalog.get_byte(
      pg_catalog.decode(
        replace(gen_random_uuid()::text, '-', ''),
        'hex'
      ),
      0
    );

    -- 234 is divisible by 26: every letter has equal probability.
    if random_byte < 234 then
      generated_code := generated_code ||
        substr(alphabet, (random_byte % 26) + 1, 1);
    end if;
  end loop;

  return generated_code;
end;
$$;

revoke all on function public.generate_study_group_invite_code()
  from public, anon, authenticated;


-- 2. Convert the invite column from UUID to text.
alter table public.study_group_invites
  alter column invite_code drop default;

alter table public.study_group_invites
  alter column invite_code type text
  using invite_code::text;


-- 3. Replace existing codes, retrying if a code is already used.
do $$
declare
  invitation record;
  replacement_code text;
  attempt_count integer;
begin
  for invitation in
    select group_id from public.study_group_invites
  loop
    attempt_count := 0;

    loop
      attempt_count := attempt_count + 1;
      replacement_code := public.generate_study_group_invite_code();

      begin
        update public.study_group_invites
        set invite_code = replacement_code
        where group_id = invitation.group_id;

        exit;
      exception
        when unique_violation then
          if attempt_count >= 20 then
            raise exception 'Could not generate a unique invite code.';
          end if;
      end;
    end loop;
  end loop;
end;
$$;

alter table public.study_group_invites
  add constraint study_group_invites_code_format_check
  check (invite_code ~ '^[A-Z]{6}$');

alter table public.study_group_invites
  alter column invite_code
  set default public.generate_study_group_invite_code();


-- 4. Create future groups with collision handling.
create or replace function public.create_study_group(
  p_name text,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_group_id uuid;
  clean_name text := trim(p_name);
  clean_description text := trim(coalesce(p_description, ''));
  attempt_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Please log in to create a study group.';
  end if;

  if clean_name is null
    or char_length(clean_name) not between 1 and 80 then
    raise exception 'Group name must contain 1–80 characters.';
  end if;

  if char_length(clean_description) > 500 then
    raise exception 'Description must not exceed 500 characters.';
  end if;

  insert into public.study_groups(owner_id, name, description)
  values (current_user_id, clean_name, clean_description)
  returning id into new_group_id;

  insert into public.study_group_members(group_id, user_id)
  values (new_group_id, current_user_id);

  loop
    attempt_count := attempt_count + 1;

    insert into public.study_group_invites(group_id)
    values (new_group_id)
    on conflict (invite_code) do nothing;

    if found then
      exit;
    end if;

    if attempt_count >= 20 then
      raise exception 'Could not generate a unique invite code.';
    end if;
  end loop;

  return new_group_id;
end;
$$;

revoke all on function public.create_study_group(text, text)
  from public, anon;

grant execute on function public.create_study_group(text, text)
  to authenticated;


-- 5. Recreate the owner-only lookup with a text return type.
-- PostgreSQL cannot change a function's return type with CREATE OR REPLACE.
drop function public.get_study_group_invite(uuid);

create function public.get_study_group_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_invite_code text;
begin
  if current_user_id is null then
    raise exception 'Please log in to view the invite code.';
  end if;

  if not exists (
    select 1
    from public.study_groups
    where id = p_group_id
      and owner_id = current_user_id
  ) then
    raise exception 'Group unavailable or you are not its owner.';
  end if;

  select invite_code into saved_invite_code
  from public.study_group_invites
  where group_id = p_group_id;

  if not found then
    raise exception 'Invite code unavailable.';
  end if;

  return saved_invite_code;
end;
$$;

revoke all on function public.get_study_group_invite(uuid)
  from public, anon;

grant execute on function public.get_study_group_invite(uuid)
  to authenticated;


-- 6. Private record of failed join attempts.
create table public.study_group_join_attempts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  created_at timestamptz not null default now()
);

create index study_group_join_attempts_user_date_idx
  on public.study_group_join_attempts(user_id, created_at);

alter table public.study_group_join_attempts
  enable row level security;

revoke all on public.study_group_join_attempts
  from public, anon, authenticated;


-- 7. Replace the UUID join function with a text-code version.
-- Return statuses instead of raising for invalid codes so failed-attempt
-- records are committed rather than rolled back.
drop function public.join_study_group(uuid);

create function public.join_study_group(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_code text := upper(trim(coalesce(p_invite_code, '')));
  matched_group_id uuid;
  checked_at timestamptz;
  failed_attempts bigint;
begin
  if current_user_id is null then
    return pg_catalog.jsonb_build_object(
      'status', 'unauthorized'
    );
  end if;

  -- Serialize join checks for this account to prevent concurrent bypass.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'study-group-join:' || current_user_id::text,
      0
    )
  );

  checked_at := pg_catalog.clock_timestamp();

  -- Keep only the recent failures for this account.
  delete from public.study_group_join_attempts
  where user_id = current_user_id
    and created_at <= checked_at - interval '15 minutes';

  select count(*) into failed_attempts
  from public.study_group_join_attempts
  where user_id = current_user_id
    and created_at > checked_at - interval '15 minutes';

  if failed_attempts >= 5 then
    return pg_catalog.jsonb_build_object(
      'status', 'rate_limited'
    );
  end if;

  if clean_code ~ '^[A-Z]{6}$' then
    select group_id into matched_group_id
    from public.study_group_invites
    where invite_code = clean_code;
  end if;

  if matched_group_id is null then
    insert into public.study_group_join_attempts(user_id, created_at)
    values (current_user_id, checked_at);

    return pg_catalog.jsonb_build_object(
      'status', 'invalid_code'
    );
  end if;

  insert into public.study_group_members(group_id, user_id)
  values (matched_group_id, current_user_id)
  on conflict (group_id, user_id) do nothing;

  return pg_catalog.jsonb_build_object(
    'status', 'success',
    'groupId', matched_group_id
  );
end;
$$;

revoke all on function public.join_study_group(text)
  from public, anon;

grant execute on function public.join_study_group(text)
  to authenticated;

commit;