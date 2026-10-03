begin;

-- A snapshot of a personal note or study guide, owned by the group.
-- Removing the original material or its author's account preserves the copy.
create table public.study_group_materials (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null
    references public.study_groups(id) on delete cascade,
  source_study_set_id uuid
    references public.study_sets(id) on delete set null,
  shared_by uuid
    references auth.users(id) on delete set null,
  shared_by_name text not null
    check (char_length(trim(shared_by_name)) between 1 and 80),
  title text not null
    check (char_length(trim(title)) between 1 and 120),
  subject text
    check (char_length(subject) <= 120),
  material_type text not null
    check (material_type in ('notes', 'study_guide')),
  content text not null
    check (char_length(trim(content)) between 1 and 20000),
  created_at timestamptz not null default now(),
  unique (group_id, source_study_set_id)
);

create index study_group_materials_group_date_idx
  on public.study_group_materials(group_id, created_at desc, id desc);

create index study_group_materials_source_idx
  on public.study_group_materials(source_study_set_id);

create index study_group_materials_sharer_idx
  on public.study_group_materials(shared_by);

alter table public.study_group_materials enable row level security;

revoke all on public.study_group_materials
  from public, anon, authenticated;

grant select on public.study_group_materials to authenticated;

create policy "Members can read their group's shared materials"
  on public.study_group_materials
  for select
  to authenticated
  using (public.is_study_group_member(group_id));


-- The caller supplies IDs only. Content is copied from their own Library.
create function public.share_study_group_material(
  p_group_id uuid,
  p_study_set_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  source_material public.study_sets;
  author_name text;
  shared_material_id uuid;
begin
  if current_user_id is null then
    raise exception 'Please log in to share a material.';
  end if;

  -- Use the same group lock as Leave/Remove Member, then check membership.
  perform 1 from public.study_groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'Group unavailable.';
  end if;

  if not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;

  select * into source_material
  from public.study_sets
  where id = p_study_set_id
    and user_id = current_user_id
    and material_type in ('notes', 'study_guide')
  for share;

  if not found then
    raise exception 'Choose a note or study guide from your own Library.';
  end if;

  -- Capture the display name at sharing time. Never copy email or preferences.
  select coalesce(
    case
      when pg_catalog.jsonb_typeof(account.raw_user_meta_data -> 'full_name') = 'string'
      then nullif(left(trim(account.raw_user_meta_data ->> 'full_name'), 80), '')
    end,
    case
      when pg_catalog.jsonb_typeof(account.raw_user_meta_data -> 'name') = 'string'
      then nullif(left(trim(account.raw_user_meta_data ->> 'name'), 80), '')
    end,
    'Unnamed member ' || left(current_user_id::text, 8)
  ) into author_name
  from auth.users as account
  where account.id = current_user_id;

  insert into public.study_group_materials (
    group_id, source_study_set_id, shared_by, shared_by_name,
    title, subject, material_type, content
  )
  values (
    p_group_id, source_material.id, current_user_id, author_name,
    source_material.title, source_material.subject,
    source_material.material_type, source_material.notes
  )
  on conflict (group_id, source_study_set_id) do nothing
  returning id into shared_material_id;

  -- Repeated submissions reuse the saved copy without overwriting it.
  if shared_material_id is null then
    select id into shared_material_id
    from public.study_group_materials
    where group_id = p_group_id
      and source_study_set_id = source_material.id;
  end if;

  return shared_material_id;
end;
$$;


-- Current members may remove their own shares; the owner may remove any share.
create function public.remove_study_group_material(
  p_group_id uuid,
  p_material_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  group_owner_id uuid;
  material_sharer_id uuid;
begin
  if current_user_id is null then
    raise exception 'Please log in to remove a shared material.';
  end if;

  select owner_id into group_owner_id
  from public.study_groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'Group unavailable.';
  end if;

  if not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;

  select shared_by into material_sharer_id
  from public.study_group_materials
  where id = p_material_id and group_id = p_group_id;

  -- Repeating an already-completed removal is safe.
  if not found then
    return;
  end if;

  if current_user_id <> group_owner_id
    and current_user_id is distinct from material_sharer_id then
    raise exception 'Only the sharer or group owner can remove this material.';
  end if;

  delete from public.study_group_materials
  where id = p_material_id and group_id = p_group_id;
end;
$$;

revoke all on function public.share_study_group_material(uuid, uuid)
  from public, anon;
revoke all on function public.remove_study_group_material(uuid, uuid)
  from public, anon;

grant execute on function public.share_study_group_material(uuid, uuid)
  to authenticated;
grant execute on function public.remove_study_group_material(uuid, uuid)
  to authenticated;

commit;
