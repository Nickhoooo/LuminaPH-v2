begin;

-- A path is the student's saved study plan. Lesson content can be generated later.
create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  subject text not null check (char_length(trim(subject)) between 1 and 120),
  learning_goal text not null check (char_length(trim(learning_goal)) between 1 and 1000),
  education_level text not null check (education_level in ('junior-high', 'senior-high', 'college', 'independent')),
  academic_details text not null default '' check (char_length(academic_details) <= 120),
  language text not null check (language in ('english', 'filipino', 'taglish')),
  created_at timestamptz not null default now()
);

create index learning_paths_owner_date_idx on public.learning_paths(user_id, created_at desc);

create table public.learning_path_lessons (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  position integer not null check (position between 1 and 8),
  title text not null check (char_length(trim(title)) between 1 and 120),
  objective text not null check (char_length(trim(objective)) between 1 and 1000),
  completed boolean not null default false,
  unique (path_id, position)
);

alter table public.learning_paths enable row level security;
alter table public.learning_path_lessons enable row level security;
revoke all on public.learning_paths, public.learning_path_lessons from anon, authenticated;
grant select, insert on public.learning_paths to authenticated;
grant select, insert on public.learning_path_lessons to authenticated;
-- Users may change their self-reported progress, not the saved AI outline.
grant update (completed) on public.learning_path_lessons to authenticated;

create policy "Read own learning paths" on public.learning_paths
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own learning paths" on public.learning_paths
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Read lessons in own paths" on public.learning_path_lessons
  for select to authenticated using (
    exists (select 1 from public.learning_paths p where p.id = path_id and p.user_id = (select auth.uid()))
  );
create policy "Create lessons in own paths" on public.learning_path_lessons
  for insert to authenticated with check (
    exists (select 1 from public.learning_paths p where p.id = path_id and p.user_id = (select auth.uid()))
  );
create policy "Update progress in own paths" on public.learning_path_lessons
  for update to authenticated using (
    exists (select 1 from public.learning_paths p where p.id = path_id and p.user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.learning_paths p where p.id = path_id and p.user_id = (select auth.uid()))
  );

-- Save a complete outline in one transaction. Any invalid lesson rolls it all back.
create function public.create_learning_path(
  p_title text, p_subject text, p_learning_goal text,
  p_education_level text, p_academic_details text, p_language text,
  p_lessons jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_path_id uuid;
  lesson jsonb;
  lesson_position integer := 0;
begin
  if auth.uid() is null then raise exception 'Please log in to create a learning path.'; end if;
  if pg_catalog.jsonb_typeof(p_lessons) is distinct from 'array' then
    raise exception 'Lessons must be an array.';
  end if;
  if pg_catalog.jsonb_array_length(p_lessons) not between 3 and 8 then
    raise exception 'A learning path must contain 3–8 lessons.';
  end if;
  insert into public.learning_paths(user_id, title, subject, learning_goal, education_level, academic_details, language)
    values (auth.uid(), p_title, p_subject, p_learning_goal, p_education_level, p_academic_details, p_language)
    returning id into new_path_id;
  for lesson in select value from pg_catalog.jsonb_array_elements(p_lessons)
  loop
    if pg_catalog.jsonb_typeof(lesson) is distinct from 'object'
      or pg_catalog.jsonb_typeof(lesson -> 'title') is distinct from 'string'
      or pg_catalog.jsonb_typeof(lesson -> 'objective') is distinct from 'string' then
      raise exception 'Each lesson requires a title and objective.';
    end if;
    lesson_position := lesson_position + 1;
    insert into public.learning_path_lessons(path_id, position, title, objective)
      values (new_path_id, lesson_position, lesson ->> 'title', lesson ->> 'objective');
  end loop;
  return new_path_id;
end;
$$;

revoke all on function public.create_learning_path(text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_learning_path(text, text, text, text, text, text, jsonb) to authenticated;

commit;
