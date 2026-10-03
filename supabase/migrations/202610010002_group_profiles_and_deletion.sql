begin;

alter table public.study_groups add column avatar_path text;

-- Private images are readable only by current group members.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-group-avatars', 'study-group-avatars', false, 512000,
  array['image/jpeg', 'image/png', 'image/webp']);

create policy "Members read group avatars" on storage.objects
for select to authenticated using (
  bucket_id = 'study-group-avatars' and (split_part(storage.objects.name, '/', 1) = (select auth.uid())::text or exists (
    select 1 from public.study_groups g
    where g.id::text = split_part(storage.objects.name, '/', 2)
      and public.is_study_group_member(g.id)
  ))
);

create policy "Owners upload group avatars" on storage.objects
for insert to authenticated with check (
  bucket_id = 'study-group-avatars'
  and split_part(storage.objects.name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1 from public.study_groups g
    where g.id::text = split_part(storage.objects.name, '/', 2) and g.owner_id = (select auth.uid())
  )
);

create policy "Owners remove their group avatar uploads" on storage.objects
for delete to authenticated using (
  bucket_id = 'study-group-avatars'
  and split_part(storage.objects.name, '/', 1) = (select auth.uid())::text
);

create function public.set_study_group_avatar(p_group_id uuid, p_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  group_owner uuid;
begin
  select owner_id into group_owner from public.study_groups where id = p_group_id for update;
  if not found or auth.uid() is null or group_owner <> auth.uid() then
    raise exception 'Only the group owner can change its image.';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> auth.uid()::text
    or split_part(p_path, '/', 2) <> p_group_id::text
    or not exists (select 1 from storage.objects where bucket_id = 'study-group-avatars' and name = p_path) then
    raise exception 'Group image unavailable.';
  end if;
  update public.study_groups set avatar_path = p_path where id = p_group_id;
end;
$$;

-- Group foreign keys cascade to memberships, invites, shared copies and tracks.
-- Personal Library originals are not deleted.
create function public.delete_study_group(p_group_id uuid, p_confirmation text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  saved_group public.study_groups;
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  select * into saved_group from public.study_groups where id = p_group_id for update;
  if not found then return; end if;
  if saved_group.owner_id <> auth.uid() then
    raise exception 'Only the owner can delete this group.';
  end if;
  if p_confirmation is distinct from saved_group.name then
    raise exception 'Type the group name exactly to confirm deletion.';
  end if;
  delete from public.study_groups where id = p_group_id;
end;
$$;

revoke all on function public.set_study_group_avatar(uuid, text) from public, anon;
revoke all on function public.delete_study_group(uuid, text) from public, anon;
grant execute on function public.set_study_group_avatar(uuid, text) to authenticated;
grant execute on function public.delete_study_group(uuid, text) to authenticated;

commit;
