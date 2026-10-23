begin;

-- A shared snapshot can be removed independently of its original Library note.
create function public.clear_shared_material_notification_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set href = null
  where href = '/study-tools/study-groups/' || old.group_id::text
    || '/materials/' || old.id::text;
  return old;
end;
$$;

create trigger deleted_shared_material_notification_links
before delete on public.study_group_materials
for each row execute function public.clear_shared_material_notification_links();

-- Keep a former member's event history without linking to private group pages.
create function public.clear_former_member_notification_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_prefix text := '/study-tools/study-groups/' || old.group_id::text;
begin
  update public.notifications set href = null
  where user_id = old.user_id
    and (href = group_prefix or href like group_prefix || '/%');
  return old;
end;
$$;

create trigger removed_member_notification_links
after delete on public.study_group_members
for each row execute function public.clear_former_member_notification_links();

-- Repair notices saved before these triggers existed, including former members.
update public.notifications n set href = null
where n.href like '/study-tools/study-groups/%'
  and (
    not exists (
      select 1 from public.study_group_members m
      where m.user_id = n.user_id and m.group_id::text = split_part(n.href, '/', 4)
    )
    or (
      split_part(n.href, '/', 5) = 'materials'
      and not exists (
        select 1 from public.study_group_materials material
        where material.id::text = split_part(split_part(split_part(n.href, '/', 6), '?', 1), '#', 1)
          and material.group_id::text = split_part(n.href, '/', 4)
      )
    )
  );

revoke all on function public.clear_shared_material_notification_links()
  from public, anon, authenticated;
revoke all on function public.clear_former_member_notification_links()
  from public, anon, authenticated;

commit;
