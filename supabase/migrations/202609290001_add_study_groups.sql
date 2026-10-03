begin;

-- Basic information about each study group.
create table public.study_groups (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null
    references auth.users(id),

  name text not null
    check (char_length(trim(name)) between 1 and 80),

  description text not null default ''
    check (char_length(description) <= 500),

  created_at timestamptz not null default now()
);

-- Block client access until we define the allowed operations.
alter table public.study_groups enable row level security;

revoke all on public.study_groups
  from public, anon, authenticated;

-- Accounts that belong to each study group.
create table public.study_group_members (
  group_id uuid not null
    references public.study_groups(id) on delete cascade,

  user_id uuid not null
    references auth.users(id) on delete cascade,

  joined_at timestamptz not null default now(),

  primary key (group_id, user_id)
);

-- Helps find all groups joined by a particular user.
create index study_group_members_user_idx
  on public.study_group_members(user_id);

alter table public.study_group_members enable row level security;

revoke all on public.study_group_members
  from public, anon, authenticated;

-- One private invite code per study group.
create table public.study_group_invites (
  group_id uuid primary key
    references public.study_groups(id) on delete cascade,

  invite_code uuid not null unique
    default gen_random_uuid(),

  created_at timestamptz not null default now()
);

alter table public.study_group_invites enable row level security;

revoke all on public.study_group_invites
  from public, anon, authenticated;

-- Check whether the logged-in user belongs to this group.
create function public.is_study_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.study_group_members
    where group_id = p_group_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_study_group_member(uuid)
  from public, anon;

grant execute on function public.is_study_group_member(uuid)
  to authenticated;

-- Allow logged-in users to read rows permitted by the policies below.
grant select on public.study_groups, public.study_group_members
  to authenticated;

create policy "Members can read their groups"
  on public.study_groups
  for select
  to authenticated
  using (public.is_study_group_member(id));

create policy "Members can read their group membership list"
  on public.study_group_members
  for select
  to authenticated
  using (public.is_study_group_member(group_id));

-- Create the group, owner membership, and invite together.
create function public.create_study_group(
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

  insert into public.study_group_invites(group_id)
  values (new_group_id);

  return new_group_id;
end;
$$;

revoke all on function public.create_study_group(text, text)
  from public, anon;

grant execute on function public.create_study_group(text, text)
  to authenticated;  

-- Join a group using its invite code.
create function public.join_study_group(p_invite_code uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  matched_group_id uuid;
begin
  if current_user_id is null then
    raise exception 'Please log in to join a study group.';
  end if;

  if p_invite_code is null then
    raise exception 'An invite code is required.';
  end if;

  select group_id into matched_group_id
  from public.study_group_invites
  where invite_code = p_invite_code;

  if not found then
    raise exception 'This invite code is invalid or no longer available.';
  end if;

  insert into public.study_group_members(group_id, user_id)
  values (matched_group_id, current_user_id)
  on conflict (group_id, user_id) do nothing;

  return matched_group_id;
end;
$$;

revoke all on function public.join_study_group(uuid)
  from public, anon;

grant execute on function public.join_study_group(uuid)
  to authenticated;  

-- Only the group owner can retrieve its invite code.
create function public.get_study_group_invite(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_invite_code uuid;
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

commit;
