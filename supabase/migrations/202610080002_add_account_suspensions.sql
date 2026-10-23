begin;

-- Kapag may record dito, suspended ang account.
-- Hindi mabubura ang existing learning materials niya.
create table public.account_suspensions (
  user_id uuid primary key
    references auth.users(id) on delete cascade,

  reason text not null
    check (char_length(trim(reason)) between 1 and 1000),

  suspended_by uuid
    references auth.users(id) on delete set null,

  suspended_at timestamptz not null default now()
);

alter table public.account_suspensions
  enable row level security;

-- Walang direct client insert, update, o delete.
revoke all on public.account_suspensions
  from public, anon, authenticated;

grant select on public.account_suspensions
  to authenticated;

create policy "Administrators can read account suspensions"
  on public.account_suspensions
  for select
  to authenticated
  using (public.is_app_administrator());


-- Sariling status lang ang puwedeng malaman ng ordinary user.
-- Hindi nito ibinabalik ang internal reason o admin information.
create function public.is_current_account_suspended()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.account_suspensions
    where user_id = current_user_id
  ) then
    return true;
  else
    return false;
  end if;
end;
$$;

revoke all on function public.is_current_account_suspended()
  from public, anon, authenticated;

grant execute on function public.is_current_account_suspended()
  to authenticated;

commit;