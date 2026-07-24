-- Shared progress tables used by Marina and Olya.
-- Run once in the common Supabase project zqzgarvmpqqqaobeicpc.

create table if not exists public.homework_progress (
  student_id text not null,
  student_name text,
  lesson_id text not null,
  lesson_title text,
  status text not null default 'checked' check (status in ('checked','submitted')),
  answers jsonb not null default '{}'::jsonb,
  legacy_answers jsonb,
  migrated_from_legacy boolean not null default false,
  score_correct integer,
  score_total integer,
  score_percent integer,
  checked_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

create table if not exists public.vocabulary_progress (
  student_id text not null,
  word_key text not null,
  word_id text,
  en text,
  ru text,
  source_topic_id text,
  status text not null check (status in ('known','difficult')),
  learned_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, word_key)
);

create table if not exists public.vocabulary_topic_progress (
  student_id text not null,
  topic_id text not null,
  tests jsonb not null default '[]'::jsonb,
  legacy_learned_count integer not null default 0,
  legacy_total integer not null default 0,
  legacy_source text,
  legacy_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, topic_id)
);

create table if not exists public.grammar_progress (
  student_id text not null,
  topic_id text not null,
  passed boolean not null default false,
  attempts integer not null default 0,
  best_score integer not null default 0,
  passed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, topic_id)
);


-- If the tables already existed before this migration, add the fields used by
-- the current Marina/Olya client without deleting existing data.
alter table public.homework_progress add column if not exists student_name text;
alter table public.homework_progress add column if not exists lesson_title text;
alter table public.homework_progress add column if not exists status text not null default 'checked';
alter table public.homework_progress add column if not exists answers jsonb not null default '{}'::jsonb;
alter table public.homework_progress add column if not exists legacy_answers jsonb;
alter table public.homework_progress add column if not exists migrated_from_legacy boolean not null default false;
alter table public.homework_progress add column if not exists score_correct integer;
alter table public.homework_progress add column if not exists score_total integer;
alter table public.homework_progress add column if not exists score_percent integer;
alter table public.homework_progress add column if not exists checked_at timestamptz;
alter table public.homework_progress add column if not exists submitted_at timestamptz;
alter table public.homework_progress add column if not exists updated_at timestamptz not null default now();

alter table public.vocabulary_progress add column if not exists word_id text;
alter table public.vocabulary_progress add column if not exists en text;
alter table public.vocabulary_progress add column if not exists ru text;
alter table public.vocabulary_progress add column if not exists source_topic_id text;
alter table public.vocabulary_progress add column if not exists status text;
alter table public.vocabulary_progress add column if not exists learned_at timestamptz;
alter table public.vocabulary_progress add column if not exists updated_at timestamptz not null default now();

alter table public.vocabulary_topic_progress add column if not exists tests jsonb not null default '[]'::jsonb;
alter table public.vocabulary_topic_progress add column if not exists legacy_learned_count integer not null default 0;
alter table public.vocabulary_topic_progress add column if not exists legacy_total integer not null default 0;
alter table public.vocabulary_topic_progress add column if not exists legacy_source text;
alter table public.vocabulary_topic_progress add column if not exists legacy_updated_at timestamptz;
alter table public.vocabulary_topic_progress add column if not exists updated_at timestamptz not null default now();

alter table public.grammar_progress add column if not exists passed boolean not null default false;
alter table public.grammar_progress add column if not exists attempts integer not null default 0;
alter table public.grammar_progress add column if not exists best_score integer not null default 0;
alter table public.grammar_progress add column if not exists passed_at timestamptz;
alter table public.grammar_progress add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_progress_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['homework_progress','vocabulary_progress','vocabulary_topic_progress','grammar_progress'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_progress_updated_at()', t, t);
  end loop;
end $$;

alter table public.homework_progress enable row level security;
alter table public.vocabulary_progress enable row level security;
alter table public.vocabulary_topic_progress enable row level security;
alter table public.grammar_progress enable row level security;

-- These policies reproduce the current no-login architecture used by Marina.
-- They keep the two students separated by student_id in data, but anonymous clients
-- can technically choose another student_id. For stronger isolation, add Supabase Auth.
do $$
declare t text;
begin
  foreach t in array array['homework_progress','vocabulary_progress','vocabulary_topic_progress','grammar_progress'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='anon read progress') then
      execute format('create policy "anon read progress" on public.%I for select to anon using (true)', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='anon insert progress') then
      execute format('create policy "anon insert progress" on public.%I for insert to anon with check (true)', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='anon update progress') then
      execute format('create policy "anon update progress" on public.%I for update to anon using (true) with check (true)', t);
    end if;
  end loop;
end $$;

grant select, insert, update on public.homework_progress to anon;
grant select, insert, update on public.vocabulary_progress to anon;
grant select, insert, update on public.vocabulary_topic_progress to anon;
grant select, insert, update on public.grammar_progress to anon;
