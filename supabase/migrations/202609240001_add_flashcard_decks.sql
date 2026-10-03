begin;

-- 1. Allow 'flashcards' as a material_type, without touching existing
--    'notes' / 'study_guide' behavior or the RLS policies already in place.
alter table public.study_sets
  drop constraint study_sets_material_type_check;

alter table public.study_sets
  add constraint study_sets_material_type_check
    check (material_type in ('notes', 'study_guide', 'flashcards'));

-- 2. New JSONB column to hold the question/answer pairs for a flashcard deck.
--    Defaults to an empty array so existing 'notes' / 'study_guide' rows
--    are unaffected.
alter table public.study_sets
  add column flashcards jsonb not null default '[]'::jsonb
    constraint study_sets_flashcards_array_check
    check (pg_catalog.jsonb_typeof(flashcards) = 'array');

-- 3. Helper function: a valid flashcard deck is an array of 5 or 10 objects,
--    Questions allow 1-240 characters; answers allow 1-600 characters.
create or replace function public.is_valid_flashcard_deck(cards jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  card jsonb;
begin
  if pg_catalog.jsonb_typeof(cards) is distinct from 'array' then
    return false;
  end if;

  if pg_catalog.jsonb_array_length(cards) not in (5, 10) then
    return false;
  end if;

  for card in
    select value from pg_catalog.jsonb_array_elements(cards)
  loop
    if pg_catalog.jsonb_typeof(card) is distinct from 'object' then
      return false;
    end if;

    if pg_catalog.jsonb_typeof(card -> 'question')
         is distinct from 'string'
       or pg_catalog.jsonb_typeof(card -> 'answer')
         is distinct from 'string' then
      return false;
    end if;

    if pg_catalog.length(pg_catalog.btrim(card ->> 'question'))
         not between 1 and 240
       or pg_catalog.length(pg_catalog.btrim(card ->> 'answer'))
         not between 1 and 600 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- 4. Enforce the 5-or-10-card rule only for flashcards decks; for
--    'notes' / 'study_guide' rows, flashcards must stay an empty array,
--    so old data (which gets the column default) already satisfies this.
alter table public.study_sets
  add constraint study_sets_flashcards_check
    check (
      case
        when material_type = 'flashcards'
          then public.is_valid_flashcard_deck(flashcards)
        else flashcards = '[]'::jsonb
      end
    );

-- 5. Deck content lives in flashcards. Notes and guides still require text.
alter table public.study_sets
  drop constraint study_sets_notes_check,
  add constraint study_sets_notes_check check (
    (material_type = 'flashcards' and notes = '')
    or
    (
      material_type in ('notes', 'study_guide')
      and char_length(trim(notes)) between 1 and 20000
    )
  );

commit;
