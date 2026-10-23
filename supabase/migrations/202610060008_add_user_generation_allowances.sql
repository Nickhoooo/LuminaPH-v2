begin;

create table public.user_generation_allowances (
  user_id uuid primary key
    references auth.users(id) on delete cascade,

  mode text not null
    check (mode in ('default', 'custom', 'unlimited')),

  material_limit integer,
  tutor_limit integer,

  updated_by uuid
    references auth.users(id) on delete set null,

  updated_at timestamptz not null default now(),

  constraint user_generation_allowances_limits_check
    check (
      (
        mode = 'custom'
        and material_limit is not null
        and tutor_limit is not null
        and material_limit between 1 and 1000
        and tutor_limit between 1 and 1000
      )
      or
      (
        mode in ('default', 'unlimited')
        and material_limit is null
        and tutor_limit is null
      )
    )
);

alter table public.user_generation_allowances
  enable row level security;

revoke all on public.user_generation_allowances
  from public, anon, authenticated;

grant select on public.user_generation_allowances
  to authenticated;

create policy "Administrators can read user allowances"
  on public.user_generation_allowances
  for select
  to authenticated
  using (public.is_app_administrator());

commit;