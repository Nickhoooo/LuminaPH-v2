begin;

-- Per-tool routes point only to registered Groq models. Secrets remain in the
-- server environment; this table stores model IDs and routing metadata only.
create table public.ai_tool_routes (
  tool_key text primary key check (tool_key in (
    'study_guide', 'flashcards', 'quiz', 'group_quiz', 'tutor',
    'learning_path', 'group_lesson'
  )),
  primary_model_id uuid not null references public.ai_model_registry(id) on delete restrict,
  fallback_model_id uuid references public.ai_model_registry(id) on delete restrict,
  updated_at timestamptz not null default transaction_timestamp(),
  check (fallback_model_id is null or fallback_model_id <> primary_model_id)
);

alter table public.ai_tool_routes enable row level security;
revoke all on table public.ai_tool_routes from public, anon, authenticated;

insert into public.ai_tool_routes(tool_key, primary_model_id)
select tool.tool_key, settings.active_model_id
from public.ai_runtime_settings as settings
cross join (values
  ('study_guide'), ('flashcards'), ('quiz'), ('group_quiz'),
  ('tutor'), ('learning_path'), ('group_lesson')
) as tool(tool_key)
where settings.singleton = true;

create or replace function public.get_admin_ai_model_registry()
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
    raise exception 'Suspended administrators cannot view AI settings.';
  end if;

  select pg_catalog.jsonb_build_object(
    'activeModelId', settings.active_model_id,
    'models', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', model.id,
        'provider', model.provider,
        'modelId', model.model_id,
        'displayName', model.display_name,
        'enabled', model.enabled,
        'createdAt', model.created_at
      ) order by model.created_at, model.display_name)
      from public.ai_model_registry as model
    ), '[]'::jsonb),
    'routes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'toolKey', route.tool_key,
        'primaryModelId', route.primary_model_id,
        'fallbackModelId', route.fallback_model_id
      ) order by route.tool_key)
      from public.ai_tool_routes as route
    ), '[]'::jsonb)
  ) into result
  from public.ai_runtime_settings as settings
  where settings.singleton = true;

  return result;
end;
$$;

create function public.get_active_ai_model(p_tool_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
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

  select pg_catalog.jsonb_build_object(
    'primaryModel', primary_model.model_id,
    'fallbackModel', fallback_model.model_id
  ) into result
  from public.ai_tool_routes as route
  join public.ai_model_registry as primary_model
    on primary_model.id = route.primary_model_id and primary_model.enabled = true
  left join public.ai_model_registry as fallback_model
    on fallback_model.id = route.fallback_model_id and fallback_model.enabled = true
  where route.tool_key = p_tool_key;

  if result is null then
    raise exception 'No enabled model route is configured for this AI tool.';
  end if;
  return result;
end;
$$;

create function public.set_ai_tool_route(
  p_tool_key text,
  p_primary_model_id uuid,
  p_fallback_model_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  primary_model text;
  fallback_model text;
begin
  if actor_id is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot change AI settings.';
  end if;
  if p_tool_key is null or p_tool_key not in (
    'study_guide', 'flashcards', 'quiz', 'group_quiz', 'tutor',
    'learning_path', 'group_lesson'
  ) then
    raise exception 'Choose a valid AI tool.';
  end if;
  if p_primary_model_id is null or p_fallback_model_id = p_primary_model_id then
    raise exception 'Choose different primary and fallback models.';
  end if;

  lock table public.ai_tool_routes in share row exclusive mode;
  select model.model_id into primary_model
  from public.ai_model_registry as model
  where model.id = p_primary_model_id and model.enabled = true;
  if not found then
    raise exception 'Choose an enabled primary model.';
  end if;

  if p_fallback_model_id is not null then
    select model.model_id into fallback_model
    from public.ai_model_registry as model
    where model.id = p_fallback_model_id and model.enabled = true;
    if not found then
      raise exception 'Choose an enabled fallback model.';
    end if;
  end if;

  insert into public.ai_tool_routes(tool_key, primary_model_id, fallback_model_id, updated_at)
  values (p_tool_key, p_primary_model_id, p_fallback_model_id, transaction_timestamp())
  on conflict (tool_key) do update
    set primary_model_id = excluded.primary_model_id,
        fallback_model_id = excluded.fallback_model_id,
        updated_at = excluded.updated_at;

  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings', 'Changed AI route for ' || p_tool_key,
    pg_catalog.jsonb_build_object(
      'operation', 'set_tool_route', 'tool', p_tool_key,
      'primaryModel', primary_model, 'fallbackModel', fallback_model
    )
  );
  return true;
end;
$$;

-- A model cannot be disabled while any tool depends on it.
create or replace function public.set_ai_model_enabled(p_model_id uuid, p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_active_model_id uuid;
  selected_model text;
  actor_id uuid := auth.uid();
begin
  if actor_id is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot change AI settings.';
  end if;
  if p_model_id is null or p_enabled is null then
    raise exception 'Choose a model and a valid enabled state.';
  end if;

  lock table public.ai_tool_routes in share row exclusive mode;
  select settings.active_model_id into current_active_model_id
  from public.ai_runtime_settings as settings
  where settings.singleton = true for update;
  select model.model_id into selected_model
  from public.ai_model_registry as model where model.id = p_model_id;
  if not found then
    raise exception 'Model not found.';
  end if;
  if p_enabled is false and (
    p_model_id = current_active_model_id
    or exists (
      select 1 from public.ai_tool_routes as route
      where route.primary_model_id = p_model_id or route.fallback_model_id = p_model_id
    )
  ) then
    raise exception 'Move all routes to another model before disabling this one.';
  end if;

  update public.ai_model_registry set enabled = p_enabled where id = p_model_id;
  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings',
    case when p_enabled then 'Enabled Groq model: ' else 'Disabled Groq model: ' end || selected_model,
    pg_catalog.jsonb_build_object('operation', 'set_enabled', 'modelId', selected_model, 'enabled', p_enabled)
  );
  return true;
end;
$$;

create or replace function public.activate_ai_model(p_model_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_model text;
  previous_model text;
begin
  if actor_id is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot change AI settings.';
  end if;
  if p_model_id is null then
    raise exception 'Choose a model.';
  end if;

  lock table public.ai_tool_routes in share row exclusive mode;
  perform 1 from public.ai_runtime_settings where singleton = true for update;
  select model.model_id into selected_model
  from public.ai_model_registry as model
  where model.id = p_model_id and model.enabled = true;
  if not found then
    raise exception 'Choose an enabled model.';
  end if;
  select model.model_id into previous_model
  from public.ai_runtime_settings as settings
  join public.ai_model_registry as model on model.id = settings.active_model_id
  where settings.singleton = true;

  update public.ai_runtime_settings
  set active_model_id = p_model_id, updated_at = transaction_timestamp()
  where singleton = true;
  update public.ai_tool_routes
  set primary_model_id = p_model_id, fallback_model_id = null, updated_at = transaction_timestamp();
  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings', 'Set all AI tools to Groq model: ' || selected_model,
    pg_catalog.jsonb_build_object(
      'operation', 'activate_global_model', 'previousModel', previous_model,
      'activeModel', selected_model
    )
  );
  return true;
end;
$$;

-- Removal is allowed only after the disabled model is no longer the global
-- default or referenced as a primary/fallback route.
create or replace function public.delete_ai_model(p_model_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_model text;
begin
  if actor_id is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot change AI settings.';
  end if;
  if p_model_id is null then
    raise exception 'Choose a model.';
  end if;

  lock table public.ai_tool_routes in share row exclusive mode;
  perform 1 from public.ai_runtime_settings where singleton = true for update;
  if exists (select 1 from public.ai_runtime_settings where singleton = true and active_model_id = p_model_id) then
    raise exception 'The global default model cannot be removed.';
  end if;
  if exists (
    select 1 from public.ai_tool_routes as route
    where route.primary_model_id = p_model_id or route.fallback_model_id = p_model_id
  ) then
    raise exception 'Remove this model from every tool route before deleting it.';
  end if;
  select model.model_id into selected_model
  from public.ai_model_registry as model
  where model.id = p_model_id and model.enabled = false;
  if not found then
    raise exception 'Only disabled models can be removed.';
  end if;

  delete from public.ai_model_registry where id = p_model_id;
  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings', 'Removed disabled Groq model: ' || selected_model,
    pg_catalog.jsonb_build_object('operation', 'remove_model', 'modelId', selected_model)
  );
  return true;
end;
$$;

revoke all on function public.get_active_ai_model(text) from public, anon;
revoke all on function public.set_ai_tool_route(text, uuid, uuid) from public, anon;
grant execute on function public.get_active_ai_model(text) to authenticated;
grant execute on function public.set_ai_tool_route(text, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
