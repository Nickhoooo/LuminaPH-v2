begin;

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  reading_size text not null default 'normal' check (reading_size in ('normal', 'large')),
  reduce_motion boolean not null default false,
  quiz_notifications boolean not null default true,
  group_notifications boolean not null default true,
  admin_notifications boolean not null default true
);
alter table public.user_settings enable row level security;
revoke all on public.user_settings from public, anon, authenticated;
grant select, insert on public.user_settings to authenticated;
grant update (user_id, theme, reading_size, reduce_motion, quiz_notifications, group_notifications, admin_notifications)
  on public.user_settings to authenticated;
create policy "Read own settings" on public.user_settings for select to authenticated using (user_id = (select auth.uid()));
create policy "Create own settings" on public.user_settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Update own settings" on public.user_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create unique index group_invitations_pending_idx on public.group_invitations(group_id, recipient_id) where status = 'pending';
create index group_invitations_recipient_idx on public.group_invitations(recipient_id, created_at desc);
alter table public.group_invitations enable row level security;
revoke all on public.group_invitations from public, anon, authenticated;
grant select on public.group_invitations to authenticated;
create policy "Read received invitations" on public.group_invitations for select to authenticated using (recipient_id = (select auth.uid()));

create table public.group_invitation_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp()
);
create index group_invitation_attempts_user_date_idx on public.group_invitation_attempts(user_id, created_at);
alter table public.group_invitation_attempts enable row level security;
revoke all on public.group_invitation_attempts from public, anon, authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('group_invite', 'quiz_result', 'password_changed', 'group_update', 'admin')),
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 2000),
  href text,
  invitation_id uuid references public.group_invitations(id) on delete set null,
  event_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, event_key)
);
create index notifications_user_date_idx on public.notifications(user_id, created_at desc, id desc);
create index notifications_unread_idx on public.notifications(user_id) where read_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "Read own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "Mark own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.invite_group_member(p_group_id uuid, p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  saved_group public.study_groups;
  recipient uuid;
  invitation uuid;
begin
  if caller is null then raise exception 'Please log in.'; end if;
  select * into saved_group from public.study_groups where id = p_group_id for update;
  if not found or saved_group.owner_id <> caller then raise exception 'Only the group owner can invite members.'; end if;
  if p_email is null or char_length(trim(p_email)) not between 3 and 254 then raise exception 'Enter a valid email.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 3102026));
  if (select count(*) from public.group_invitation_attempts where user_id = caller and created_at > clock_timestamp() - interval '1 hour') >= 20 then
    return 'rate_limited';
  end if;
  insert into public.group_invitation_attempts(user_id) values (caller);
  select id into recipient from auth.users where lower(email) = lower(trim(p_email)) and email_confirmed_at is not null limit 1;
  -- Same response for nonexistent accounts, current members, self, and duplicates.
  if recipient is null or recipient = caller or exists (
    select 1 from public.study_group_members where group_id = p_group_id and user_id = recipient
  ) then return 'processed'; end if;
  update public.group_invitations set status = 'expired'
    where group_id = p_group_id and recipient_id = recipient and status = 'pending' and expires_at <= now();
  insert into public.group_invitations(group_id, recipient_id, sender_id)
    values (p_group_id, recipient, caller)
    on conflict (group_id, recipient_id) where status = 'pending' do nothing returning id into invitation;
  if invitation is not null then
    insert into public.notifications(user_id, kind, title, message, invitation_id, event_key)
      values (recipient, 'group_invite', 'Study group invitation',
        'You have been invited to ' || saved_group.name || '. Accept to join, or decline.', invitation, 'invite:' || invitation::text);
  end if;
  return 'processed';
end;
$$;

create function public.respond_group_invitation(p_invitation_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  saved_invitation public.group_invitations;
  group_owner uuid;
begin
  if auth.uid() is null or p_accept is null then raise exception 'Please log in and choose a response.'; end if;
  select * into saved_invitation from public.group_invitations where id = p_invitation_id and recipient_id = auth.uid();
  if not found then return 'unavailable'; end if;
  -- Match the lock order used by group removal/deletion.
  select owner_id into group_owner from public.study_groups where id = saved_invitation.group_id for update;
  if not found then return 'unavailable'; end if;
  select * into saved_invitation from public.group_invitations where id = p_invitation_id and recipient_id = auth.uid() for update;
  if not found then return 'unavailable'; end if;
  if saved_invitation.status <> 'pending' then return saved_invitation.status; end if;
  if saved_invitation.expires_at <= now() or group_owner <> saved_invitation.sender_id then
    update public.group_invitations set status = 'expired' where id = p_invitation_id;
    update public.notifications set read_at = coalesce(read_at, now()) where invitation_id = p_invitation_id and user_id = auth.uid();
    return 'expired';
  end if;
  if p_accept then
    insert into public.study_group_members(group_id, user_id) values (saved_invitation.group_id, auth.uid()) on conflict do nothing;
  end if;
  update public.group_invitations set status = case when p_accept then 'accepted' else 'declined' end where id = p_invitation_id;
  update public.notifications set read_at = coalesce(read_at, now()) where invitation_id = p_invitation_id and user_id = auth.uid();
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;

-- Read-time expiry uses the database clock without mutating the invitation.
create function public.get_received_group_invitations(p_ids uuid[])
returns table (id uuid, status text)
language sql stable security invoker set search_path = '' as $$
  select i.id, case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end
  from public.group_invitations i
  where i.recipient_id = auth.uid() and i.id = any(p_ids)
  limit 20;
$$;
revoke all on function public.get_received_group_invitations(uuid[]) from public, anon;
grant execute on function public.get_received_group_invitations(uuid[]) to authenticated;

-- Quiz notices use the scored row, never client-supplied notification text.
create function public.notify_quiz_result()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  quiz_title text;
  link text;
  group_id uuid;
begin
  if not coalesce((select quiz_notifications from public.user_settings where user_id = new.user_id), true) then return new; end if;
  if tg_table_name = 'quiz_attempts' then
    select title into quiz_title from public.study_sets where id = new.study_set_id;
    link := '/library/' || new.study_set_id::text || '#quiz-attempts';
  else
    select lesson.title, track.group_id into quiz_title, group_id
      from public.group_track_quizzes quiz join public.group_track_lessons lesson on lesson.id = quiz.lesson_id
      join public.group_study_tracks track on track.id = lesson.track_id where quiz.id = new.quiz_id;
    link := '/study-tools/study-groups/' || group_id::text || '/quizzes/' || new.quiz_id::text || '?attempt=' || new.id::text;
  end if;
  insert into public.notifications(user_id, kind, title, message, href, event_key)
    values (new.user_id, 'quiz_result', 'Your quiz result is ready',
      coalesce(quiz_title, 'Quiz') || ': ' || new.score::text || '/' || new.question_count::text || '. Open your review.',
      link, tg_table_name || ':' || new.id::text) on conflict do nothing;
  return new;
end;
$$;
create trigger quiz_result_notification after insert on public.quiz_attempts for each row execute function public.notify_quiz_result();
create trigger group_quiz_result_notification after insert on public.group_track_quiz_attempts for each row execute function public.notify_quiz_result();

-- This fires only when Auth actually changes the password hash. No hash is copied.
create function public.notify_password_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id, kind, title, message, href, event_key)
    values (new.id, 'password_changed', 'Password changed',
      'Your account password was changed. If this was not you, reset your password and review your account security.',
      '/settings', 'password:' || gen_random_uuid()::text);
  return new;
end;
$$;
create trigger password_changed_notification after update of encrypted_password on auth.users
  for each row when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.notify_password_changed();

create function public.notify_group_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_group uuid;
  actor uuid;
  label text;
  link text;
begin
  if tg_table_name = 'study_group_materials' then
    target_group := new.group_id;
    actor := new.shared_by;
    label := 'New shared material: ' || new.title;
    link := '/study-tools/study-groups/' || target_group::text || '/materials/' || new.id::text;
  elsif tg_table_name = 'group_track_lessons' then
    select t.group_id, g.owner_id into target_group, actor from public.group_study_tracks t
      join public.study_groups g on g.id = t.group_id where t.id = new.track_id;
    label := 'Lesson ready: ' || new.title;
    link := '/study-tools/study-groups/' || target_group::text || '/lessons/' || new.id::text;
  else
    select t.group_id, g.owner_id, 'Quiz ready: ' || l.title into target_group, actor, label
      from public.group_track_lessons l join public.group_study_tracks t on t.id = l.track_id
      join public.study_groups g on g.id = t.group_id where l.id = new.lesson_id;
    link := '/study-tools/study-groups/' || target_group::text || '/quizzes/' || new.id::text;
  end if;
  insert into public.notifications(user_id, kind, title, message, href, event_key)
    select m.user_id, 'group_update', 'Study group update', label, link, tg_table_name || ':' || new.id::text
    from public.study_group_members m left join public.user_settings s on s.user_id = m.user_id
    where m.group_id = target_group and m.user_id is distinct from actor and coalesce(s.group_notifications, true)
    on conflict do nothing;
  return new;
end;
$$;
create trigger shared_material_notification after insert on public.study_group_materials for each row execute function public.notify_group_activity();
create trigger group_lesson_ready_notification after update of generated_at on public.group_track_lessons
  for each row when (old.generated_at is null and new.generated_at is not null) execute function public.notify_group_activity();
create trigger group_quiz_ready_notification after update of generated_at on public.group_track_quizzes
  for each row when (old.generated_at is null and new.generated_at is not null) execute function public.notify_group_activity();

-- Administrators are assigned through trusted database access, not user metadata.
create table public.app_administrators (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.app_administrators enable row level security;
revoke all on public.app_administrators from public, anon, authenticated;
create table public.admin_announcements (
  id uuid primary key,
  author_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  message text not null check (char_length(trim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.admin_announcements enable row level security;
revoke all on public.admin_announcements from public, anon, authenticated;

create function public.is_app_administrator()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.app_administrators where user_id = auth.uid());
$$;

create function public.publish_admin_announcement(p_id uuid, p_title text, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  saved public.admin_announcements;
begin
  if not public.is_app_administrator() then raise exception 'Administrator access required.'; end if;
  insert into public.admin_announcements(id, author_id, title, message)
    values (p_id, auth.uid(), trim(p_title), trim(p_message)) on conflict (id) do nothing;
  select * into saved from public.admin_announcements where id = p_id;
  if saved.author_id is distinct from auth.uid() or saved.title is distinct from trim(p_title) or saved.message is distinct from trim(p_message) then
    raise exception 'This announcement ID was already used.';
  end if;
  insert into public.notifications(user_id, kind, title, message, href, event_key)
    select u.id, 'admin', saved.title, saved.message, null, 'announcement:' || saved.id::text
    from auth.users u left join public.user_settings s on s.user_id = u.id
    where u.email_confirmed_at is not null and coalesce(s.admin_notifications, true)
    on conflict do nothing;
end;
$$;

-- Keep the event history, but never send learners to deleted material/group pages.
create function public.clear_deleted_notification_links()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  prefix text;
begin
  if tg_table_name = 'study_sets' then
    prefix := '/library/' || old.id::text;
    update public.notifications set href = null
      where split_part(split_part(href, '?', 1), '#', 1) = prefix;
  else
    prefix := '/study-tools/study-groups/' || old.id::text;
    update public.notifications set href = null where href = prefix or href like prefix || '/%';
  end if;
  return old;
end;
$$;
create trigger deleted_material_notification_links before delete on public.study_sets for each row execute function public.clear_deleted_notification_links();
create trigger deleted_group_notification_links before delete on public.study_groups for each row execute function public.clear_deleted_notification_links();
revoke all on function public.clear_deleted_notification_links() from public, anon, authenticated;

revoke all on function public.invite_group_member(uuid, text), public.respond_group_invitation(uuid, boolean),
  public.is_app_administrator(), public.publish_admin_announcement(uuid, text, text) from public, anon;
grant execute on function public.invite_group_member(uuid, text), public.respond_group_invitation(uuid, boolean),
  public.is_app_administrator(), public.publish_admin_announcement(uuid, text, text) to authenticated;
revoke all on function public.notify_quiz_result(), public.notify_password_changed(), public.notify_group_activity() from public, anon, authenticated;

commit;
