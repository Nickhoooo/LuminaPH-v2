begin;

-- Reading is self-reported via Mark lesson complete. Apply the same rule to
-- direct RPC calls, including owners taking their own group's quizzes.
create function public.require_group_quiz_lesson(p_group_id uuid, p_quiz_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;
  if not exists (
    select 1 from public.group_track_quizzes quiz
    join public.group_track_lessons lesson on lesson.id = quiz.lesson_id
    join public.group_study_tracks track on track.id = lesson.track_id
    join public.group_track_lesson_progress progress on progress.lesson_id = lesson.id
    where quiz.id = p_quiz_id and track.group_id = p_group_id
      and progress.user_id = auth.uid() and lesson.content is not null
  ) then
    raise exception 'Read and mark this lesson complete before taking its quiz.';
  end if;
end;
$$;

revoke all on function public.require_group_quiz_lesson(uuid, uuid)
  from public, anon, authenticated;

-- Return only completion positions, never scores, answers or private material.
-- Group totals include every current member, independently of the current page.
create function public.get_group_study_dashboard(p_group_id uuid, p_page integer default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  dashboard jsonb;
begin
  if auth.uid() is null or not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;
  if p_page is null or p_page not between 1 and 50000 then
    raise exception 'Invalid page number.';
  end if;

  with member_progress as materialized (
    select member.user_id,
      array(
        select lesson.position from public.group_track_lesson_progress progress
        join public.group_track_lessons lesson on lesson.id = progress.lesson_id
        join public.group_study_tracks track on track.id = lesson.track_id
        where progress.user_id = member.user_id and track.group_id = p_group_id
        order by lesson.position
      ) as lessons,
      array(
        select distinct lesson.position from public.group_track_quiz_attempts attempt
        join public.group_track_quizzes quiz on quiz.id = attempt.quiz_id
        join public.group_track_lessons lesson on lesson.id = quiz.lesson_id
        join public.group_study_tracks track on track.id = lesson.track_id
        where attempt.user_id = member.user_id and track.group_id = p_group_id
        order by lesson.position
      ) as quizzes
    from public.study_group_members member where member.group_id = p_group_id
  )
  select jsonb_build_object(
    'memberCount', (select count(*) from member_progress),
    'finishedCount', (select count(*) from member_progress where cardinality(lessons) = 5 and cardinality(quizzes) = 5),
    'completedActivities', (select coalesce(sum(cardinality(lessons) + cardinality(quizzes)), 0) from member_progress),
    'self', (select jsonb_build_object('lessons', lessons, 'quizzes', quizzes) from member_progress where user_id = auth.uid()),
    'checkpoints', (
      select jsonb_agg(jsonb_build_object('position', stage.position, 'membersReached', (
        select count(*) from member_progress progress
        where not exists (
          select 1 from generate_series(1, stage.position) required(position)
          where not (required.position = any(progress.lessons) and required.position = any(progress.quizzes))
        )
      )) order by stage.position) from generate_series(1, 5) stage(position)
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', member.user_id, 'displayName', member.display_name,
        'isOwner', member.is_owner, 'lessons', progress.lessons, 'quizzes', progress.quizzes
      ) order by member.is_owner desc, member.joined_at, member.user_id)
      from public.list_study_group_members(p_group_id, p_page) member
      join member_progress progress on progress.user_id = member.user_id
    ), '[]'::jsonb)
  ) into dashboard;
  return dashboard;
end;
$$;

revoke all on function public.get_group_study_dashboard(uuid, integer) from public, anon;
grant execute on function public.get_group_study_dashboard(uuid, integer) to authenticated;

-- Existing quiz RPCs are replaced below, preserving their signatures and grants.

create or replace function public.get_group_track_quiz(p_group_id uuid, p_quiz_id uuid)
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
  perform public.require_group_quiz_lesson(p_group_id, p_quiz_id);

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

create or replace function public.submit_group_track_quiz(
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

  perform public.require_group_quiz_lesson(p_group_id, p_quiz_id);

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

create or replace function public.get_group_track_quiz_review(p_group_id uuid, p_attempt_id uuid)
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
    and track.group_id = p_group_id
    and exists (
      select 1 from public.group_track_lesson_progress progress
      where progress.lesson_id = lesson.id and progress.user_id = auth.uid()
    );
  if not found then raise exception 'Quiz attempt unavailable.'; end if;
  return saved_questions;
end;
$$;

commit;
