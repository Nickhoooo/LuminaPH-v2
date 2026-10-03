begin;

alter table public.study_sets
  add column material_type text not null default 'notes'
    check (material_type in ('notes', 'study_guide')),

  add column request_details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_details) = 'object'),

  add column sources jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sources) = 'array');

alter table public.study_sets
  drop constraint study_sets_subject_check;

alter table public.study_sets
  add constraint study_sets_subject_check
    check (char_length(subject) <= 120);

commit; 