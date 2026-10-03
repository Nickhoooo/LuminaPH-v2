begin;

create table public.study_sets (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  title text not null
    check (char_length(trim(title)) between 1 and 120),

  subject text
    check (char_length(subject) <= 80),

  notes text not null
    check (char_length(trim(notes)) between 1 and 20000),

  created_at timestamptz not null default now()
);

create index study_sets_user_id_idx
  on public.study_sets(user_id);

alter table public.study_sets enable row level security;

revoke all on table public.study_sets from anon, authenticated;

grant select, insert on table public.study_sets to authenticated;

create policy "Users can read their own study sets"
  on public.study_sets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own study sets"
  on public.study_sets
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

commit;