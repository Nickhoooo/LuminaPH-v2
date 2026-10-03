begin;

-- One private conversation per learner and saved study guide.
create table public.tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_set_id uuid not null references public.study_sets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, study_set_id)
);

-- A turn is one question + one reply. Save them together after generation.
-- The client keeps the same ID when retrying an uncertain save.
create table public.tutor_turns (
  id uuid primary key,
  conversation_id uuid not null references public.tutor_conversations(id) on delete cascade,
  turn_number integer not null check (turn_number > 0),
  question text not null check (char_length(trim(question)) between 1 and 2000),
  answer text not null check (char_length(trim(answer)) between 1 and 12000),
  created_at timestamptz not null default now(),
  unique (conversation_id, turn_number)
);

alter table public.tutor_conversations enable row level security;
alter table public.tutor_turns enable row level security;
revoke all on public.tutor_conversations, public.tutor_turns from public, anon, authenticated;
grant select on public.tutor_conversations, public.tutor_turns to authenticated;

create policy "Read own tutor conversations" on public.tutor_conversations
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Read turns in own conversations" on public.tutor_turns
  for select to authenticated using (
    exists (
      select 1 from public.tutor_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

create function public.open_lesson_tutor(p_study_set_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  conversation_id uuid;
begin
  if current_user_id is null then raise exception 'Please log in to use AI Tutor.'; end if;
  if not exists (
    select 1 from public.study_sets
    where id = p_study_set_id and user_id = current_user_id and material_type = 'study_guide'
  ) then raise exception 'Study guide unavailable.'; end if;

  insert into public.tutor_conversations(user_id, study_set_id)
    values (current_user_id, p_study_set_id)
    on conflict (user_id, study_set_id) do nothing;

  select id into conversation_id from public.tutor_conversations
    where user_id = current_user_id and study_set_id = p_study_set_id;
  return conversation_id;
end;
$$;

create function public.save_tutor_turn(
  p_conversation_id uuid,
  p_turn_id uuid,
  p_question text,
  p_answer text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  owned_conversation public.tutor_conversations;
  existing_turn public.tutor_turns;
  next_turn_number integer;
begin
  if current_user_id is null then raise exception 'Please log in to save this conversation.'; end if;
  if p_turn_id is null then raise exception 'A turn ID is required.'; end if;

  -- Lock this conversation while assigning its next sequence number.
  select * into owned_conversation from public.tutor_conversations
    where id = p_conversation_id and user_id = current_user_id for update;
  if not found then raise exception 'Conversation unavailable.'; end if;
  if not exists (
    select 1 from public.study_sets
    where id = owned_conversation.study_set_id and user_id = current_user_id
      and material_type = 'study_guide'
  ) then raise exception 'Study guide unavailable.'; end if;

  select * into existing_turn from public.tutor_turns where id = p_turn_id;
  if found then
    if existing_turn.conversation_id <> p_conversation_id
      or existing_turn.question is distinct from trim(p_question)
      or existing_turn.answer is distinct from trim(p_answer) then
      raise exception 'This turn ID was already used for a different exchange.';
    end if;
    return existing_turn.id;
  end if;

  if p_question is null or char_length(trim(p_question)) not between 1 and 2000 then
    raise exception 'Questions must contain 1–2,000 characters.';
  end if;
  if p_answer is null or char_length(trim(p_answer)) not between 1 and 12000 then
    raise exception 'Replies must contain 1–12,000 characters.';
  end if;

  select coalesce(max(turn_number), 0) + 1 into next_turn_number
    from public.tutor_turns where conversation_id = p_conversation_id;
  insert into public.tutor_turns(id, conversation_id, turn_number, question, answer)
    values (p_turn_id, p_conversation_id, next_turn_number, trim(p_question), trim(p_answer));
  return p_turn_id;
end;
$$;

revoke all on function public.open_lesson_tutor(uuid) from public, anon;
revoke all on function public.save_tutor_turn(uuid, uuid, text, text) from public, anon;
grant execute on function public.open_lesson_tutor(uuid) to authenticated;
grant execute on function public.save_tutor_turn(uuid, uuid, text, text) to authenticated;

commit;
