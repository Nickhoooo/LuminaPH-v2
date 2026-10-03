begin;

-- Full lesson text lives in study_sets as a study_guide so the Library,
-- Markdown renderer, flashcards, and quizzes can reuse the existing material.
alter table public.learning_path_lessons
  add column study_set_id uuid unique
    references public.study_sets(id) on delete set null;

-- Prevent direct inserts from attaching an arbitrary user's material.
-- Existing outline inserts and completed-only updates remain supported.
revoke insert on public.learning_path_lessons from authenticated;
grant insert (id, path_id, position, title, objective, completed)
  on public.learning_path_lessons to authenticated;

create function public.save_path_lesson_content(
  p_path_id uuid,
  p_lesson_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_path public.learning_paths;
  saved_lesson public.learning_path_lessons;
  material_id uuid;
begin
  if current_user_id is null then
    raise exception 'Please log in to save lesson content.';
  end if;

  select * into saved_path from public.learning_paths
    where id = p_path_id and user_id = current_user_id;
  if not found then raise exception 'Learning path unavailable.'; end if;

  -- Serialize saves for this lesson. The second request reuses the first guide.
  select * into saved_lesson from public.learning_path_lessons
    where id = p_lesson_id and path_id = saved_path.id
    for update;
  if not found then raise exception 'Lesson unavailable in this learning path.'; end if;

  if saved_lesson.study_set_id is not null then
    if not exists (
      select 1 from public.study_sets
      where id = saved_lesson.study_set_id
        and user_id = current_user_id and material_type = 'study_guide'
    ) then raise exception 'Saved lesson reference is invalid.'; end if;
    return saved_lesson.study_set_id;
  end if;

  if p_content is null or char_length(trim(p_content)) not between 1 and 20000 then
    raise exception 'Lesson content must contain 1–20,000 characters.';
  end if;

  -- Create the guide and attach it in one transaction. Never overwrite a
  -- previously saved lesson or change its self-reported completion status.
  insert into public.study_sets(user_id, title, subject, material_type, notes, request_details, sources)
  values (
    current_user_id, saved_lesson.title, saved_path.subject, 'study_guide', trim(p_content),
    pg_catalog.jsonb_build_object(
      'educationLevel', saved_path.education_level,
      'academicDetails', saved_path.academic_details,
      'subject', saved_path.subject,
      'learningGoal', saved_lesson.objective,
      'language', saved_path.language,
      'sourceStatus', 'general_unverified',
      'learningPath', pg_catalog.jsonb_build_object('id', saved_path.id, 'title', saved_path.title),
      'pathLesson', pg_catalog.jsonb_build_object('id', saved_lesson.id, 'position', saved_lesson.position)
    ),
    '[]'::jsonb
  ) returning id into material_id;

  update public.learning_path_lessons set study_set_id = material_id
    where id = saved_lesson.id and path_id = saved_path.id;
  return material_id;
end;
$$;

revoke all on function public.save_path_lesson_content(uuid, uuid, text) from public, anon;
grant execute on function public.save_path_lesson_content(uuid, uuid, text) to authenticated;

commit;
