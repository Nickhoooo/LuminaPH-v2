begin;

-- Each quiz contains 5 or 10 questions with exactly four distinct choices.
-- correctIndex uses 0, 1, 2, 3 (the array positions of A, B, C, D).
create function public.is_valid_quiz(questions jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  question jsonb;
  choice jsonb;
begin
  if pg_catalog.jsonb_typeof(questions) is distinct from 'array' then
    return false;
  end if;
  if pg_catalog.jsonb_array_length(questions) not in (5, 10) then
    return false;
  end if;
  for question in select value from pg_catalog.jsonb_array_elements(questions)
  loop
    if pg_catalog.jsonb_typeof(question) is distinct from 'object'
      or pg_catalog.jsonb_typeof(question -> 'question') is distinct from 'string'
      or pg_catalog.jsonb_typeof(question -> 'explanation') is distinct from 'string'
      or pg_catalog.jsonb_typeof(question -> 'choices') is distinct from 'array'
      or pg_catalog.jsonb_typeof(question -> 'correctIndex') is distinct from 'number' then
      return false;
    end if;
    if pg_catalog.length(pg_catalog.btrim(question ->> 'question')) not between 1 and 500
      or pg_catalog.length(pg_catalog.btrim(question ->> 'explanation')) not between 1 and 1200
      or (question ->> 'correctIndex') not in ('0', '1', '2', '3')
      or pg_catalog.jsonb_array_length(question -> 'choices') <> 4 then
      return false;
    end if;
    for choice in select value from pg_catalog.jsonb_array_elements(question -> 'choices')
    loop
      if pg_catalog.jsonb_typeof(choice) is distinct from 'string' then
        return false;
      end if;
      if pg_catalog.length(pg_catalog.btrim(choice #>> '{}')) not between 1 and 240 then
        return false;
      end if;
    end loop;
    if (select count(distinct pg_catalog.lower(pg_catalog.btrim(value)))
        from pg_catalog.jsonb_array_elements_text(question -> 'choices')) <> 4 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

alter table public.study_sets
  add column quiz_questions jsonb not null default '[]'::jsonb;

alter table public.study_sets
  drop constraint study_sets_material_type_check,
  add constraint study_sets_material_type_check
    check (material_type in ('notes', 'study_guide', 'flashcards', 'quiz')),
  drop constraint study_sets_notes_check,
  add constraint study_sets_notes_check check (
    (material_type in ('flashcards', 'quiz') and notes = '')
    or (material_type in ('notes', 'study_guide')
      and char_length(trim(notes)) between 1 and 20000)
  ),
  add constraint study_sets_quiz_questions_check check (
    case when material_type = 'quiz' then public.is_valid_quiz(quiz_questions)
      else quiz_questions = '[]'::jsonb end
  );

-- Retakes create new rows. Quiz content and earlier results remain unchanged.
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_set_id uuid not null references public.study_sets(id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  question_count integer not null check (question_count in (5, 10)),
  score integer not null check (score between 0 and question_count),
  submitted_at timestamptz not null default now(),
  check (jsonb_array_length(answers) = question_count)
);

create index quiz_attempts_user_quiz_date_idx
  on public.quiz_attempts(user_id, study_set_id, submitted_at desc);

alter table public.quiz_attempts enable row level security;
revoke all on public.quiz_attempts from anon, authenticated;
grant select on public.quiz_attempts to authenticated;
create policy "Users can read their own quiz attempts"
  on public.quiz_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

-- Only this function writes attempts. Clients submit choices, never a score.
-- p_attempt_id is generated once for a submission and reused on network retries.
create function public.submit_quiz_attempt(
  p_attempt_id uuid,
  p_study_set_id uuid,
  p_answers jsonb
)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  questions jsonb;
  question_total integer;
  correct_total integer := 0;
  answer_index integer;
  saved_attempt public.quiz_attempts;
begin
  if current_user_id is null then
    raise exception 'Please log in before submitting a quiz.';
  end if;
  if p_attempt_id is null then
    raise exception 'A submission ID is required.';
  end if;
  select quiz_questions into questions from public.study_sets
    where id = p_study_set_id and user_id = current_user_id and material_type = 'quiz';
  if not found then
    raise exception 'Quiz unavailable.';
  end if;
  question_total := pg_catalog.jsonb_array_length(questions);
  if pg_catalog.jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'Answers must be an array.';
  end if;
  if pg_catalog.jsonb_array_length(p_answers) <> question_total then
    raise exception 'Answer every question before submitting.';
  end if;
  for answer_index in 0..question_total - 1
  loop
    if pg_catalog.jsonb_typeof(p_answers -> answer_index) is distinct from 'number' then
      raise exception 'Choose one answer for every question.';
    end if;
    if (p_answers ->> answer_index) not in ('0', '1', '2', '3') then
      raise exception 'An answer choice is invalid.';
    end if;
    if (p_answers ->> answer_index)::integer =
      (questions -> answer_index ->> 'correctIndex')::integer then
      correct_total := correct_total + 1;
    end if;
  end loop;

  insert into public.quiz_attempts(id, user_id, study_set_id, answers, question_count, score)
    values (p_attempt_id, current_user_id, p_study_set_id, p_answers, question_total, correct_total)
    on conflict (id) do nothing;

  select * into saved_attempt from public.quiz_attempts
    where id = p_attempt_id and user_id = current_user_id;
  if not found then
    raise exception 'Submission ID unavailable.';
  end if;
  if saved_attempt.study_set_id <> p_study_set_id or saved_attempt.answers <> p_answers then
    raise exception 'This submission ID was already used for different answers.';
  end if;
  return saved_attempt;
end;
$$;

revoke all on function public.submit_quiz_attempt(uuid, uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid, uuid, jsonb) to authenticated;

commit;
