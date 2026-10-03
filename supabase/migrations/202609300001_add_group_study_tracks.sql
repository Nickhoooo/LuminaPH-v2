begin;

-- First version: one saved study track per group, shared by all members.
create table public.group_study_tracks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique
    references public.study_groups(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  subject text not null check (char_length(trim(subject)) between 1 and 120),
  learning_goal text not null check (char_length(trim(learning_goal)) between 1 and 1000),
  education_level text not null
    check (education_level in ('junior-high', 'senior-high', 'college', 'independent')),
  academic_details text not null default '' check (char_length(academic_details) <= 120),
  language text not null check (language in ('english', 'filipino', 'taglish')),
  created_at timestamptz not null default now()
);

-- All five outline slots are created together; content is generated later.
create table public.group_track_lessons (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.group_study_tracks(id) on delete cascade,
  position integer not null check (position between 1 and 5),
  title text not null check (char_length(trim(title)) between 1 and 120),
  objective text not null check (char_length(trim(objective)) between 1 and 1000),
  content text check (char_length(trim(content)) between 1 and 20000),
  generated_at timestamptz,
  unique (track_id, position),
  check ((content is null) = (generated_at is null))
);

-- Exactly one quiz slot per lesson. Answer keys are not directly client-readable.
-- Questions follow the existing 5-or-10-question multiple-choice format.
create table public.group_track_quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique
    references public.group_track_lessons(id) on delete cascade,
  questions jsonb,
  generated_at timestamptz,
  check (questions is null or public.is_valid_quiz(questions)),
  check ((questions is null) = (generated_at is null))
);

-- A read-completion mark belongs to a particular learner and lesson.
-- Shared lesson content never carries a global "completed" flag.
create table public.group_track_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.group_track_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index group_track_progress_lesson_idx
  on public.group_track_lesson_progress(lesson_id);

-- Retakes are separate attempts. Scores/answers remain private to the learner.
-- Public group summaries will expose completion counts, not private answers.
create table public.group_track_quiz_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.group_track_quizzes(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  question_count integer not null check (question_count in (5, 10)),
  score integer not null check (score between 0 and question_count),
  submitted_at timestamptz not null default now(),
  check (jsonb_array_length(answers) = question_count)
);

create index group_track_attempts_user_quiz_date_idx
  on public.group_track_quiz_attempts(user_id, quiz_id, submitted_at desc);
create index group_track_attempts_quiz_idx
  on public.group_track_quiz_attempts(quiz_id);

alter table public.group_study_tracks enable row level security;
alter table public.group_track_lessons enable row level security;
alter table public.group_track_quizzes enable row level security;
alter table public.group_track_lesson_progress enable row level security;
alter table public.group_track_quiz_attempts enable row level security;

revoke all on public.group_study_tracks, public.group_track_lessons,
  public.group_track_quizzes, public.group_track_lesson_progress,
  public.group_track_quiz_attempts
  from public, anon, authenticated;

grant select on public.group_study_tracks, public.group_track_lessons,
  public.group_track_lesson_progress, public.group_track_quiz_attempts
  to authenticated;

-- Only readiness metadata is exposed. A later quiz-taking RPC will omit keys.
grant select (id, lesson_id, generated_at)
  on public.group_track_quizzes to authenticated;

create policy "Members read their group track"
  on public.group_study_tracks for select to authenticated
  using (public.is_study_group_member(group_id));

create policy "Members read their group lessons"
  on public.group_track_lessons for select to authenticated
  using (exists (
    select 1 from public.group_study_tracks track
    where track.id = track_id
      and public.is_study_group_member(track.group_id)
  ));

create policy "Members read quiz readiness"
  on public.group_track_quizzes for select to authenticated
  using (exists (
    select 1 from public.group_track_lessons lesson
    join public.group_study_tracks track on track.id = lesson.track_id
    where lesson.id = lesson_id
      and public.is_study_group_member(track.group_id)
  ));

create policy "Members read current classmates lesson completion"
  on public.group_track_lesson_progress for select to authenticated
  using (exists (
    select 1 from public.group_track_lessons lesson
    join public.group_study_tracks track on track.id = lesson.track_id
    join public.study_group_members member on member.group_id = track.group_id
    where lesson.id = lesson_id
      and member.user_id = group_track_lesson_progress.user_id
      and public.is_study_group_member(track.group_id)
  ));

create policy "Members read only their own quiz attempts"
  on public.group_track_quiz_attempts for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.group_track_quizzes quiz
      join public.group_track_lessons lesson on lesson.id = quiz.lesson_id
      join public.group_study_tracks track on track.id = lesson.track_id
      where quiz.id = quiz_id
        and public.is_study_group_member(track.group_id)
    )
  );


-- Save an owner-approved AI outline and all 10 activity slots atomically.
-- p_request_id stays the same on a save retry; never regenerate to retry a save.
create function public.create_group_study_track(
  p_request_id uuid,
  p_group_id uuid,
  p_title text,
  p_subject text,
  p_learning_goal text,
  p_education_level text,
  p_academic_details text,
  p_language text,
  p_lessons jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  group_owner_id uuid;
  existing_track_id uuid;
  lesson jsonb;
  lesson_position integer := 0;
  new_lesson_id uuid;
begin
  if current_user_id is null then
    raise exception 'Please log in to create a group study track.';
  end if;
  if p_request_id is null then
    raise exception 'A request ID is required.';
  end if;

  select owner_id into group_owner_id from public.study_groups
  where id = p_group_id for update;
  if not found then
    raise exception 'Group unavailable.';
  end if;
  if group_owner_id <> current_user_id then
    raise exception 'Only the group owner can create its study track.';
  end if;
  if not public.is_study_group_member(p_group_id) then
    raise exception 'Group unavailable.';
  end if;

  select id into existing_track_id from public.group_study_tracks
  where group_id = p_group_id;
  if found then
    if existing_track_id = p_request_id then
      return existing_track_id;
    end if;
    raise exception 'This group already has a study track.';
  end if;

  if jsonb_typeof(p_lessons) is distinct from 'array' then
    raise exception 'Lessons must be an array.';
  end if;
  if jsonb_array_length(p_lessons) <> 5 then
    raise exception 'A group track must contain exactly five lessons.';
  end if;

  insert into public.group_study_tracks (
    id, group_id, title, subject, learning_goal,
    education_level, academic_details, language
  ) values (
    p_request_id, p_group_id, trim(p_title), trim(p_subject), trim(p_learning_goal),
    p_education_level, trim(coalesce(p_academic_details, '')), p_language
  );

  for lesson in select value from jsonb_array_elements(p_lessons)
  loop
    if jsonb_typeof(lesson) is distinct from 'object'
      or jsonb_typeof(lesson -> 'title') is distinct from 'string'
      or jsonb_typeof(lesson -> 'objective') is distinct from 'string' then
      raise exception 'Each lesson needs a title and objective.';
    end if;

    lesson_position := lesson_position + 1;
    insert into public.group_track_lessons(track_id, position, title, objective)
    values (
      p_request_id, lesson_position,
      trim(lesson ->> 'title'), trim(lesson ->> 'objective')
    ) returning id into new_lesson_id;

    insert into public.group_track_quizzes(lesson_id) values (new_lesson_id);
  end loop;

  return p_request_id;
end;
$$;

revoke all on function public.create_group_study_track(
  uuid, uuid, text, text, text, text, text, text, jsonb
) from public, anon;

grant execute on function public.create_group_study_track(
  uuid, uuid, text, text, text, text, text, text, jsonb
) to authenticated;

-- Generation, completion and scoring functions follow in the next migration.
-- There are intentionally no direct client writes to these tables.
commit;
