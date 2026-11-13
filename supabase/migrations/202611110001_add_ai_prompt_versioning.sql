begin;

create table public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  tool_key text not null check (tool_key in (
    'study_guide', 'flashcards', 'quiz', 'group_quiz', 'tutor',
    'learning_path', 'group_lesson'
  )),
  version_number integer not null check (version_number > 0),
  prompt_text text not null check (char_length(trim(prompt_text)) between 1 and 6000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default transaction_timestamp(),
  published_at timestamptz,
  tested_at timestamptz,
  tested_model text,
  test_passed boolean not null default false,
  unique (tool_key, version_number)
);

create unique index ai_prompt_one_draft_per_tool_idx
  on public.ai_prompt_versions(tool_key) where status = 'draft';
create index ai_prompt_versions_history_idx
  on public.ai_prompt_versions(tool_key, version_number desc);

create table public.ai_prompt_publications (
  tool_key text primary key check (tool_key in (
    'study_guide', 'flashcards', 'quiz', 'group_quiz', 'tutor',
    'learning_path', 'group_lesson'
  )),
  version_id uuid not null unique references public.ai_prompt_versions(id) on delete restrict,
  published_at timestamptz not null default transaction_timestamp()
);

alter table public.ai_prompt_versions enable row level security;
alter table public.ai_prompt_publications enable row level security;
revoke all on table public.ai_prompt_versions from public, anon, authenticated;
revoke all on table public.ai_prompt_publications from public, anon, authenticated;

create function public.get_admin_ai_prompt(p_tool_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or public.is_app_administrator() is not true then
    raise exception 'Administrator access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot view AI prompts.';
  end if;
  if p_tool_key is null or p_tool_key not in (
    'study_guide', 'flashcards', 'quiz', 'group_quiz', 'tutor',
    'learning_path', 'group_lesson'
  ) then
    raise exception 'Choose a valid AI tool.';
  end if;

  select pg_catalog.jsonb_build_object(
    'toolKey', p_tool_key,
    'current', (
      select pg_catalog.jsonb_build_object(
        'id', version.id,
        'version', version.version_number,
        'prompt', version.prompt_text,
        'publishedAt', publication.published_at
      )
      from public.ai_prompt_publications as publication
      join public.ai_prompt_versions as version
        on version.id = publication.version_id and version.tool_key = publication.tool_key
      where publication.tool_key = p_tool_key
    ),
    'draft', (
      select pg_catalog.jsonb_build_object(
        'id', version.id,
        'version', version.version_number,
        'prompt', version.prompt_text,
        'tested', version.test_passed,
        'testedAt', version.tested_at,
        'testedModel', version.tested_model,
        'createdAt', version.created_at
      )
      from public.ai_prompt_versions as version
      where version.tool_key = p_tool_key and version.status = 'draft'
    ),
    'history', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', version.id,
        'version', version.version_number,
        'status', version.status,
        'createdAt', version.created_at,
        'publishedAt', version.published_at,
        'testedModel', version.tested_model
      ) order by version.version_number desc)
      from public.ai_prompt_versions as version
      where version.tool_key = p_tool_key
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create function public.get_active_ai_prompt(p_tool_key text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  active_prompt text;
begin
  if auth.uid() is null then
    raise exception 'Please log in.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended accounts cannot use AI tools.';
  end if;
  if p_tool_key is null or p_tool_key not in (
    'study_guide', 'flashcards', 'quiz', 'group_quiz', 'tutor',
    'learning_path', 'group_lesson'
  ) then
    raise exception 'Unknown AI tool.';
  end if;

  select version.prompt_text into active_prompt
  from public.ai_prompt_publications as publication
  join public.ai_prompt_versions as version
    on version.id = publication.version_id and version.tool_key = publication.tool_key
  where publication.tool_key = p_tool_key and version.status = 'published';

  return active_prompt;
end;
$$;

create function public.save_ai_prompt_draft(p_tool_key text, p_prompt_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  clean_prompt text := trim(coalesce(p_prompt_text, ''));
  saved_version public.ai_prompt_versions;
  next_version integer;
begin
  if actor_id is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot change AI prompts.';
  end if;
  if p_tool_key is null or p_tool_key not in (
    'study_guide', 'flashcards', 'quiz', 'group_quiz', 'tutor',
    'learning_path', 'group_lesson'
  ) then
    raise exception 'Choose a valid AI tool.';
  end if;
  if char_length(clean_prompt) not between 1 and 6000 then
    raise exception 'Prompt guidance must contain 1 to 6000 characters.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tool_key, 0));
  select * into saved_version
  from public.ai_prompt_versions as version
  where version.tool_key = p_tool_key and version.status = 'draft'
  for update;

  if found then
    update public.ai_prompt_versions
    set prompt_text = clean_prompt,
        created_by = actor_id,
        created_at = transaction_timestamp(),
        tested_at = null,
        tested_model = null,
        test_passed = false
    where id = saved_version.id
    returning * into saved_version;
  else
    select coalesce(max(version_number), 0) + 1 into next_version
    from public.ai_prompt_versions where tool_key = p_tool_key;
    insert into public.ai_prompt_versions(tool_key, version_number, prompt_text, created_by)
    values (p_tool_key, next_version, clean_prompt, actor_id)
    returning * into saved_version;
  end if;

  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings', 'Saved AI prompt draft for ' || p_tool_key,
    pg_catalog.jsonb_build_object('operation', 'save_prompt_draft', 'tool', p_tool_key, 'version', saved_version.version_number)
  );

  return pg_catalog.jsonb_build_object(
    'id', saved_version.id, 'version', saved_version.version_number,
    'tested', saved_version.test_passed
  );
end;
$$;

create function public.mark_ai_prompt_test(
  p_tool_key text,
  p_version_id uuid,
  p_passed boolean,
  p_model text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot test AI prompts.';
  end if;
  if p_tool_key is null or p_tool_key not in (
    'study_guide', 'flashcards', 'quiz', 'group_quiz', 'tutor',
    'learning_path', 'group_lesson'
  ) or p_version_id is null or p_passed is null then
    raise exception 'Invalid AI prompt test result.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tool_key, 0));

  update public.ai_prompt_versions
  set test_passed = p_passed,
      tested_at = transaction_timestamp(),
      tested_model = case when p_passed then left(nullif(trim(coalesce(p_model, '')), ''), 160) else null end
  where id = p_version_id and tool_key = p_tool_key and status = 'draft';
  if not found then
    raise exception 'Save the prompt draft before testing it.';
  end if;
  return true;
end;
$$;

create function public.publish_ai_prompt(p_tool_key text, p_version_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_version_id uuid;
  published_version integer;
begin
  if actor_id is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot publish AI prompts.';
  end if;
  if p_tool_key is null or p_tool_key not in (
    'study_guide', 'flashcards', 'quiz', 'group_quiz', 'tutor',
    'learning_path', 'group_lesson'
  ) or p_version_id is null then
    raise exception 'Choose a tested prompt draft.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tool_key, 0));
  select publication.version_id into current_version_id
  from public.ai_prompt_publications as publication
  where publication.tool_key = p_tool_key
  for update;
  select version_number into published_version
  from public.ai_prompt_versions
  where id = p_version_id and tool_key = p_tool_key
    and status = 'draft' and test_passed = true
  for update;
  if not found then
    raise exception 'Test the current draft successfully before publishing.';
  end if;

  update public.ai_prompt_versions set status = 'archived'
  where id = current_version_id and tool_key = p_tool_key;
  update public.ai_prompt_versions
  set status = 'published', published_at = transaction_timestamp()
  where id = p_version_id and tool_key = p_tool_key;
  insert into public.ai_prompt_publications(tool_key, version_id, published_at)
  values (p_tool_key, p_version_id, transaction_timestamp())
  on conflict (tool_key) do update
    set version_id = excluded.version_id, published_at = excluded.published_at;

  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings', 'Published AI prompt for ' || p_tool_key,
    pg_catalog.jsonb_build_object('operation', 'publish_prompt', 'tool', p_tool_key, 'version', published_version)
  );
  return published_version;
end;
$$;

create function public.rollback_ai_prompt(p_tool_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_version_id uuid;
  prior_version_id uuid;
  prior_version integer;
begin
  if actor_id is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot roll back AI prompts.';
  end if;
  if p_tool_key is null or p_tool_key not in (
    'study_guide', 'flashcards', 'quiz', 'group_quiz', 'tutor',
    'learning_path', 'group_lesson'
  ) then
    raise exception 'Choose a valid AI tool.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tool_key, 0));
  select publication.version_id into current_version_id
  from public.ai_prompt_publications as publication
  where publication.tool_key = p_tool_key
  for update;
  if not found then
    raise exception 'There is no published prompt to roll back.';
  end if;

  select version.id, version.version_number into prior_version_id, prior_version
  from public.ai_prompt_versions as version
  where version.tool_key = p_tool_key
    and version.status = 'archived'
    and version.published_at is not null
    and version.id <> current_version_id
  order by version.published_at desc, version.version_number desc
  limit 1
  for update;
  if not found then
    raise exception 'There is no previous published prompt to restore.';
  end if;

  update public.ai_prompt_versions set status = 'archived'
  where id = current_version_id;
  update public.ai_prompt_versions set status = 'published'
  where id = prior_version_id;
  update public.ai_prompt_publications
  set version_id = prior_version_id, published_at = transaction_timestamp()
  where tool_key = p_tool_key;

  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings', 'Rolled back AI prompt for ' || p_tool_key,
    pg_catalog.jsonb_build_object('operation', 'rollback_prompt', 'tool', p_tool_key, 'version', prior_version)
  );
  return prior_version;
end;
$$;

revoke all on function public.get_admin_ai_prompt(text) from public, anon;
revoke all on function public.get_active_ai_prompt(text) from public, anon;
revoke all on function public.save_ai_prompt_draft(text, text) from public, anon;
revoke all on function public.mark_ai_prompt_test(text, uuid, boolean, text) from public, anon;
revoke all on function public.publish_ai_prompt(text, uuid) from public, anon;
revoke all on function public.rollback_ai_prompt(text) from public, anon;
grant execute on function public.get_admin_ai_prompt(text) to authenticated;
grant execute on function public.get_active_ai_prompt(text) to authenticated;
grant execute on function public.save_ai_prompt_draft(text, text) to authenticated;
grant execute on function public.mark_ai_prompt_test(text, uuid, boolean, text) to authenticated;
grant execute on function public.publish_ai_prompt(text, uuid) to authenticated;
grant execute on function public.rollback_ai_prompt(text) to authenticated;

notify pgrst, 'reload schema';
commit;
