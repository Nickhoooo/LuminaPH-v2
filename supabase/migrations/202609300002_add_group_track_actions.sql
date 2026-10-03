begin;

-- Lock the group before each write, matching Leave/Remove Member operations.
-- The owner saves generated content once; retries never replace shared lessons.
create function public.save_group_track_lesson(
  p_group_id uuid, p_lesson_id uuid, p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_owner_id uuid;
  saved_lesson public.group_track_lessons;
begin
  select owner_id into group_owner_id from public.study_groups
  where id = p_group_id for update;
  if not found or auth.uid() is null
    or not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;
  if group_owner_id <> auth.uid() then
    raise exception 'Only the group owner can save shared lesson content.';
  end if;

  select lesson.* into saved_lesson
  from public.group_track_lessons lesson
  join public.group_study_tracks track on track.id = lesson.track_id
  where lesson.id = p_lesson_id and track.group_id = p_group_id;
  if not found then raise exception 'Lesson unavailable.'; end if;
  if saved_lesson.content is not null then return saved_lesson.id; end if;
  if p_content is null or char_length(trim(p_content)) not between 1 and 20000 then
    raise exception 'Lesson content must contain 1–20,000 characters.';
  end if;

  update public.group_track_lessons
  set content = trim(p_content), generated_at = now()
  where id = saved_lesson.id;
  return saved_lesson.id;
end;
$$;

-- A quiz is based on its saved lesson. Once saved, its answer key stays stable.
create function public.save_group_track_quiz(
  p_group_id uuid, p_quiz_id uuid, p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_owner_id uuid;
  saved_quiz public.group_track_quizzes;
begin
  select owner_id into group_owner_id from public.study_groups
  where id = p_group_id for update;
  if not found or auth.uid() is null
    or not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;
  if group_owner_id <> auth.uid() then
    raise exception 'Only the group owner can save a shared quiz.';
  end if;

  select quiz.* into saved_quiz
  from public.group_track_quizzes quiz
  join public.group_track_lessons lesson on lesson.id = quiz.lesson_id
  join public.group_study_tracks track on track.id = lesson.track_id
  where quiz.id = p_quiz_id and track.group_id = p_group_id
    and lesson.content is not null;
  if not found then raise exception 'Generate the lesson before its quiz.'; end if;
  if saved_quiz.questions is not null then return saved_quiz.id; end if;
  if not public.is_valid_quiz(p_questions) then
    raise exception 'Quiz questions are invalid.';
  end if;

  update public.group_track_quizzes
  set questions = p_questions, generated_at = now()
  where id = saved_quiz.id;
  return saved_quiz.id;
end;
$$;

-- Completion is self-reported reading progress, not a claim of mastery.
-- Repeated clicks preserve the original completion timestamp.
create function public.complete_group_track_lesson(p_group_id uuid, p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.study_groups where id = p_group_id for update;
  if not found or auth.uid() is null
    or not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;
  if not exists (
    select 1 from public.group_track_lessons lesson
    join public.group_study_tracks track on track.id = lesson.track_id
    where lesson.id = p_lesson_id and track.group_id = p_group_id
      and lesson.content is not null
  ) then
    raise exception 'Lesson content is not available yet.';
  end if;

  insert into public.group_track_lesson_progress(user_id, lesson_id)
  values (auth.uid(), p_lesson_id)
  on conflict (user_id, lesson_id) do nothing;
end;
$$;

-- Explicitly return only question text and choices, never keys/explanations.
create function public.get_group_track_quiz(p_group_id uuid, p_quiz_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  saved_questions jsonb;
begin
  if auth.uid() is null or not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;
  select quiz.questions into saved_questions
  from public.group_track_quizzes quiz
  join public.group_track_lessons lesson on lesson.id = quiz.lesson_id
  join public.group_study_tracks track on track.id = lesson.track_id
  where quiz.id = p_quiz_id and track.group_id = p_group_id;
  if not found or saved_questions is null then
    raise exception 'Quiz is not available yet.';
  end if;

  return (
    select jsonb_agg(jsonb_build_object(
      'question', item.value -> 'question', 'choices', item.value -> 'choices'
    ) order by item.position)
    from jsonb_array_elements(saved_questions) with ordinality as item(value, position)
  );
end;
$$;

-- The client sends selected indexes, never a trusted score or a user ID.
-- Reuse p_attempt_id on retries. A retake uses a new ID.
create function public.submit_group_track_quiz(
  p_group_id uuid, p_quiz_id uuid, p_attempt_id uuid, p_answers jsonb
)
returns public.group_track_quiz_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_questions jsonb;
  question_total integer;
  correct_total integer := 0;
  answer_index integer;
  saved_attempt public.group_track_quiz_attempts;
begin
  perform 1 from public.study_groups where id = p_group_id for update;
  if not found or current_user_id is null
    or not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;
  if p_attempt_id is null then raise exception 'A submission ID is required.'; end if;

  select quiz.questions into saved_questions
  from public.group_track_quizzes quiz
  join public.group_track_lessons lesson on lesson.id = quiz.lesson_id
  join public.group_study_tracks track on track.id = lesson.track_id
  where quiz.id = p_quiz_id and track.group_id = p_group_id;
  if not found or saved_questions is null then
    raise exception 'Quiz is not available yet.';
  end if;

  question_total := jsonb_array_length(saved_questions);
  if jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'Answers must be an array.';
  end if;
  if jsonb_array_length(p_answers) <> question_total then
    raise exception 'Answer every question before submitting.';
  end if;

  for answer_index in 0..question_total - 1
  loop
    if jsonb_typeof(p_answers -> answer_index) is distinct from 'number' then
      raise exception 'Choose one answer for every question.';
    end if;
    if (p_answers ->> answer_index) not in ('0', '1', '2', '3') then
      raise exception 'An answer choice is invalid.';
    end if;
    if (p_answers ->> answer_index)::integer =
      (saved_questions -> answer_index ->> 'correctIndex')::integer then
      correct_total := correct_total + 1;
    end if;
  end loop;

  insert into public.group_track_quiz_attempts (
    id, user_id, quiz_id, answers, question_count, score
  ) values (
    p_attempt_id, current_user_id, p_quiz_id, p_answers, question_total, correct_total
  ) on conflict (id) do nothing;

  select * into saved_attempt from public.group_track_quiz_attempts
  where id = p_attempt_id and user_id = current_user_id;
  if not found then raise exception 'Submission ID unavailable.'; end if;
  if saved_attempt.quiz_id <> p_quiz_id or saved_attempt.answers <> p_answers then
    raise exception 'This submission ID was already used for different answers.';
  end if;
  return saved_attempt;
end;
$$;

-- Answers and explanations become available only after your own submission.
create function public.get_group_track_quiz_review(p_group_id uuid, p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  saved_questions jsonb;
begin
  if auth.uid() is null or not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;
  select quiz.questions into saved_questions
  from public.group_track_quiz_attempts attempt
  join public.group_track_quizzes quiz on quiz.id = attempt.quiz_id
  join public.group_track_lessons lesson on lesson.id = quiz.lesson_id
  join public.group_study_tracks track on track.id = lesson.track_id
  where attempt.id = p_attempt_id and attempt.user_id = auth.uid()
    and track.group_id = p_group_id;
  if not found then raise exception 'Quiz attempt unavailable.'; end if;
  return saved_questions;
end;
$$;

-- Reuse the existing paginated member list and display-name rules.
-- Retakes count as one completed quiz. Never expose classmates' scores/answers.
create function public.list_group_track_progress(p_group_id uuid, p_page integer default 1)
returns table (
  user_id uuid, display_name text, is_owner boolean,
  lessons_completed bigint, quizzes_completed bigint, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;

  return query
  select member.user_id, member.display_name, member.is_owner,
    (
      select count(*) from public.group_track_lesson_progress progress
      join public.group_track_lessons lesson on lesson.id = progress.lesson_id
      join public.group_study_tracks track on track.id = lesson.track_id
      where progress.user_id = member.user_id and track.group_id = p_group_id
    ),
    (
      select count(distinct attempt.quiz_id) from public.group_track_quiz_attempts attempt
      join public.group_track_quizzes quiz on quiz.id = attempt.quiz_id
      join public.group_track_lessons lesson on lesson.id = quiz.lesson_id
      join public.group_study_tracks track on track.id = lesson.track_id
      where attempt.user_id = member.user_id and track.group_id = p_group_id
    ), member.total_count
  from public.list_study_group_members(p_group_id, p_page) member;
end;
$$;

revoke all on function public.save_group_track_lesson(uuid, uuid, text) from public, anon;
revoke all on function public.save_group_track_quiz(uuid, uuid, jsonb) from public, anon;
revoke all on function public.complete_group_track_lesson(uuid, uuid) from public, anon;
revoke all on function public.get_group_track_quiz(uuid, uuid) from public, anon;
revoke all on function public.submit_group_track_quiz(uuid, uuid, uuid, jsonb) from public, anon;
revoke all on function public.get_group_track_quiz_review(uuid, uuid) from public, anon;
revoke all on function public.list_group_track_progress(uuid, integer) from public, anon;

grant execute on function public.save_group_track_lesson(uuid, uuid, text) to authenticated;
grant execute on function public.save_group_track_quiz(uuid, uuid, jsonb) to authenticated;
grant execute on function public.complete_group_track_lesson(uuid, uuid) to authenticated;
grant execute on function public.get_group_track_quiz(uuid, uuid) to authenticated;
grant execute on function public.submit_group_track_quiz(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.get_group_track_quiz_review(uuid, uuid) to authenticated;
grant execute on function public.list_group_track_progress(uuid, integer) to authenticated;

commit;
