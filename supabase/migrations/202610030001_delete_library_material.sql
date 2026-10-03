begin;

-- The caller supplies only the material ID; ownership comes from the session.
create function public.delete_library_material(p_material_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Please log in.'; end if;
  perform 1 from public.study_sets
    where id = p_material_id and user_id = current_user_id for update;
  -- An unavailable record is also a safe retry of an already-completed delete.
  if not found then return; end if;

  -- Keep the path outline, but make its deleted lesson ready to generate again.
  update public.learning_path_lessons
    set study_set_id = null, completed = false
    where study_set_id = p_material_id;

  -- Existing FKs delete quiz attempts and tutor history. Shared group snapshots
  -- survive through ON DELETE SET NULL; derived materials are separate records.
  delete from public.study_sets where id = p_material_id and user_id = current_user_id;
end;
$$;

revoke all on function public.delete_library_material(uuid) from public, anon;
grant execute on function public.delete_library_material(uuid) to authenticated;

commit;
