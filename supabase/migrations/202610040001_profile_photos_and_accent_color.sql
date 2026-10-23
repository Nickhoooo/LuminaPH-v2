begin;

alter table public.user_settings
  add column accent_color text not null default '#059669'
  check (accent_color ~ '^#[0-9A-Fa-f]{6}$');
grant update (accent_color) on public.user_settings to authenticated;

create table public.user_profile_images (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_path text,
  cover_path text
);
alter table public.user_profile_images enable row level security;
revoke all on public.user_profile_images from public, anon, authenticated;
grant select on public.user_profile_images to authenticated;
create policy "Read own profile images" on public.user_profile_images
  for select to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', false, 512000,
  array['image/webp']);

create policy "Read own profile uploads" on storage.objects
  for select to authenticated using (
    bucket_id = 'profile-images' and split_part(name, '/', 1) = (select auth.uid())::text
  );
create policy "Upload own profile images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'profile-images' and split_part(name, '/', 1) = (select auth.uid())::text
  );
create policy "Remove own profile uploads" on storage.objects
  for delete to authenticated using (
    bucket_id = 'profile-images' and split_part(name, '/', 1) = (select auth.uid())::text
  );

-- Return the previous path so the app can remove it after a successful save.
-- Lock the user's row to keep simultaneous avatar/cover changes independent.
create function public.set_profile_image(p_kind text, p_path text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  previous_path text;
begin
  if auth.uid() is null then raise exception 'Please log in.'; end if;
  if p_kind is null or p_kind not in ('avatar', 'cover') then
    raise exception 'Invalid image type.';
  end if;
  if p_path is not null and (
    split_part(p_path, '/', 1) <> auth.uid()::text
    or not exists (select 1 from storage.objects where bucket_id = 'profile-images' and name = p_path)
  ) then raise exception 'Image unavailable.'; end if;
  insert into public.user_profile_images(user_id) values (auth.uid())
    on conflict (user_id) do nothing;
  select case when p_kind = 'avatar' then avatar_path else cover_path end
    into previous_path from public.user_profile_images where user_id = auth.uid() for update;
  update public.user_profile_images set
    avatar_path = case when p_kind = 'avatar' then p_path else avatar_path end,
    cover_path = case when p_kind = 'cover' then p_path else cover_path end
    where user_id = auth.uid();
  return previous_path;
end;
$$;

alter table public.study_groups add column cover_path text;

-- Group photos reuse the existing private bucket and member/owner policies.
create function public.set_study_group_image(p_group_id uuid, p_kind text, p_path text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  saved_group public.study_groups;
begin
  select * into saved_group from public.study_groups where id = p_group_id for update;
  if not found or auth.uid() is null or saved_group.owner_id <> auth.uid() then
    raise exception 'Only the group owner can change its photos.';
  end if;
  if p_kind is null or p_kind not in ('avatar', 'cover') then
    raise exception 'Invalid image type.';
  end if;
  if p_path is not null and (
    split_part(p_path, '/', 1) <> auth.uid()::text
    or split_part(p_path, '/', 2) <> p_group_id::text
    or not exists (select 1 from storage.objects where bucket_id = 'study-group-avatars' and name = p_path)
  ) then raise exception 'Group image unavailable.'; end if;
  update public.study_groups set
    avatar_path = case when p_kind = 'avatar' then p_path else avatar_path end,
    cover_path = case when p_kind = 'cover' then p_path else cover_path end
    where id = p_group_id;
  return case when p_kind = 'avatar' then saved_group.avatar_path else saved_group.cover_path end;
end;
$$;

revoke all on function public.set_profile_image(text, text) from public, anon;
revoke all on function public.set_study_group_image(uuid, text, text) from public, anon;
grant execute on function public.set_profile_image(text, text) to authenticated;
grant execute on function public.set_study_group_image(uuid, text, text) to authenticated;

commit;
