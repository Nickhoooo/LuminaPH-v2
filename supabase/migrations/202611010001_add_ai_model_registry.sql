begin;

create table public.ai_model_registry (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'groq'),
  model_id text not null check (
    char_length(model_id) between 1 and 160
    and model_id ~ '^[A-Za-z0-9._/-]+$'
  ),
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  enabled boolean not null default true,
  created_at timestamptz not null default transaction_timestamp(),
  unique (provider, model_id)
);

create table public.ai_runtime_settings (
  singleton boolean primary key default true check (singleton),
  active_model_id uuid not null references public.ai_model_registry(id) on delete restrict,
  updated_at timestamptz not null default transaction_timestamp()
);

alter table public.ai_model_registry enable row level security;
alter table public.ai_runtime_settings enable row level security;
revoke all on table public.ai_model_registry from public, anon, authenticated;
revoke all on table public.ai_runtime_settings from public, anon, authenticated;

alter table public.admin_activity_log
  drop constraint if exists admin_activity_log_action_check;
alter table public.admin_activity_log
  add constraint admin_activity_log_action_check
  check (action in (
    'ban_user', 'unban_user', 'delete_user', 'set_usage', 'grant_admin',
    'revoke_admin', 'update_report', 'delete_report', 'update_ai_settings'
  ));

insert into public.ai_model_registry(provider, model_id, display_name)
values ('groq', 'openai/gpt-oss-120b', 'Groq · GPT OSS 120B');

insert into public.ai_runtime_settings(singleton, active_model_id)
select true, id
from public.ai_model_registry
where provider = 'groq' and model_id = 'openai/gpt-oss-120b';

create function public.get_admin_ai_model_registry()
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
      from public.ai_model_registry model
    ), '[]'::jsonb)
  ) into result
  from public.ai_runtime_settings settings
  where settings.singleton = true;

  return result;
end;
$$;

create function public.get_active_ai_model()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  active_model text;
begin
  if auth.uid() is null then
    raise exception 'Please log in.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended accounts cannot use AI tools.';
  end if;

  select model.model_id into active_model
  from public.ai_runtime_settings settings
  join public.ai_model_registry model on model.id = settings.active_model_id
  where settings.singleton = true and model.enabled = true;

  if active_model is null then
    raise exception 'No active AI model is configured.';
  end if;

  return active_model;
end;
$$;

create function public.add_ai_model(
  p_model_id text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_model_id text := trim(coalesce(p_model_id, ''));
  clean_display_name text := trim(coalesce(p_display_name, ''));
  new_model_id uuid;
  actor_id uuid := auth.uid();
begin
  if auth.uid() is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot change AI settings.';
  end if;
  if char_length(clean_model_id) not between 1 and 160
    or clean_model_id !~ '^[A-Za-z0-9._/-]+$' then
    raise exception 'Enter a valid Groq model ID.';
  end if;
  if char_length(clean_display_name) not between 1 and 100 then
    raise exception 'Enter a display name from 1 to 100 characters.';
  end if;

  insert into public.ai_model_registry(provider, model_id, display_name)
  values ('groq', clean_model_id, clean_display_name)
  returning id into new_model_id;

  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings', 'Added Groq model: ' || clean_model_id,
    pg_catalog.jsonb_build_object(
      'operation', 'add_model', 'provider', 'groq', 'modelId', clean_model_id,
      'displayName', clean_display_name
    )
  );

  return new_model_id;
exception
  when unique_violation then
    raise exception 'This Groq model is already in the registry.';
end;
$$;

create function public.set_ai_model_enabled(p_model_id uuid, p_enabled boolean)
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
  if auth.uid() is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot change AI settings.';
  end if;
  if p_model_id is null or p_enabled is null then
    raise exception 'Choose a model and a valid enabled state.';
  end if;

  select settings.active_model_id into current_active_model_id
  from public.ai_runtime_settings as settings
  where settings.singleton = true for update;
  select model.model_id into selected_model
  from public.ai_model_registry as model where model.id = p_model_id;
  if not found then
    raise exception 'Model not found.';
  end if;
  if p_enabled is false and p_model_id = current_active_model_id then
    raise exception 'Select another active model before disabling this one.';
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

create function public.activate_ai_model(p_model_id uuid)
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
  if auth.uid() is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot change AI settings.';
  end if;
  if p_model_id is null then
    raise exception 'Choose a model.';
  end if;

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
  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings', 'Activated Groq model: ' || selected_model,
    pg_catalog.jsonb_build_object(
      'operation', 'activate_model', 'previousModelId', previous_model,
      'activeModelId', selected_model
    )
  );
  return true;
end;
$$;

create function public.delete_ai_model(p_model_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_model text;
begin
  if auth.uid() is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot change AI settings.';
  end if;
  if p_model_id is null then
    raise exception 'Choose a model.';
  end if;
  perform 1 from public.ai_runtime_settings where singleton = true for update;
  if exists (
    select 1 from public.ai_runtime_settings
    where singleton = true and active_model_id = p_model_id
  ) then
    raise exception 'The active model cannot be removed.';
  end if;

  select model.model_id into selected_model
  from public.ai_model_registry as model
  where model.id = p_model_id and model.enabled = false;
  if not found then
    raise exception 'Only disabled models can be removed.';
  end if;

  delete from public.ai_model_registry where id = p_model_id and enabled = false;
  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings', 'Removed disabled Groq model: ' || selected_model,
    pg_catalog.jsonb_build_object('operation', 'remove_model', 'modelId', selected_model)
  );
  return true;
end;
$$;

revoke all on function public.get_admin_ai_model_registry() from public, anon;
revoke all on function public.get_active_ai_model() from public, anon;
revoke all on function public.add_ai_model(text, text) from public, anon;
revoke all on function public.set_ai_model_enabled(uuid, boolean) from public, anon;
revoke all on function public.activate_ai_model(uuid) from public, anon;
revoke all on function public.delete_ai_model(uuid) from public, anon;
grant execute on function public.get_admin_ai_model_registry() to authenticated;
grant execute on function public.get_active_ai_model() to authenticated;
grant execute on function public.add_ai_model(text, text) to authenticated;
grant execute on function public.set_ai_model_enabled(uuid, boolean) to authenticated;
grant execute on function public.activate_ai_model(uuid) to authenticated;
grant execute on function public.delete_ai_model(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
