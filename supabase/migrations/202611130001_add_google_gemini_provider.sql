begin;

alter table public.ai_model_registry
  drop constraint if exists ai_model_registry_provider_check;
alter table public.ai_model_registry
  add constraint ai_model_registry_provider_check
  check (provider in ('groq', 'google'));

create function public.add_ai_model(
  p_provider text,
  p_model_id text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_provider text := trim(coalesce(p_provider, ''));
  clean_model_id text := trim(coalesce(p_model_id, ''));
  clean_display_name text := trim(coalesce(p_display_name, ''));
  new_model_id uuid;
  actor_id uuid := auth.uid();
begin
  if actor_id is null or public.is_super_administrator() is not true then
    raise exception 'Super Admin access required.';
  end if;
  if public.is_current_account_suspended() then
    raise exception 'Suspended administrators cannot change AI settings.';
  end if;
  if clean_provider not in ('groq', 'google') then
    raise exception 'Choose a supported AI provider.';
  end if;
  if char_length(clean_model_id) not between 1 and 160
    or clean_model_id !~ '^[A-Za-z0-9._/-]+$' then
    raise exception 'Enter a valid model ID.';
  end if;
  if char_length(clean_display_name) not between 1 and 100 then
    raise exception 'Enter a display name from 1 to 100 characters.';
  end if;

  insert into public.ai_model_registry(provider, model_id, display_name)
  values (clean_provider, clean_model_id, clean_display_name)
  returning id into new_model_id;

  insert into public.admin_activity_log(actor_id, action, reason, details)
  values (
    actor_id, 'update_ai_settings', 'Added ' || clean_provider || ' model: ' || clean_model_id,
    pg_catalog.jsonb_build_object(
      'operation', 'add_model', 'provider', clean_provider,
      'modelId', clean_model_id, 'displayName', clean_display_name
    )
  );

  return new_model_id;
exception
  when unique_violation then
    raise exception 'This model is already registered for that provider.';
end;
$$;

create or replace function public.get_active_ai_model(p_tool_key text)
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
    'primaryProvider', primary_model.provider,
    'primaryModel', primary_model.model_id,
    'fallbackProvider', fallback_model.provider,
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

revoke all on function public.add_ai_model(text, text, text) from public, anon;
grant execute on function public.add_ai_model(text, text, text) to authenticated;
revoke all on function public.get_active_ai_model(text) from public, anon;
grant execute on function public.get_active_ai_model(text) to authenticated;

notify pgrst, 'reload schema';
commit;
