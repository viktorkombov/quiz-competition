-- =============================================================================
-- 0001_schema.sql — Tables, constraints, indexes, triggers.
-- =============================================================================
-- Uses the pgcrypto extension for gen_random_uuid(). Supabase enables it by
-- default; the create-if-not-exists is a safety net.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user (linked to auth.users).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- games: reusable quiz templates.
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null references auth.users (id) on delete cascade,
  title                     text not null,
  description               text,
  status                    text not null default 'draft'
                              check (status in ('draft', 'published', 'archived')),
  public_scoreboard_enabled boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists games_owner_id_idx on public.games (owner_id);

-- ---------------------------------------------------------------------------
-- rounds: optional groupings of questions within a game.
-- ---------------------------------------------------------------------------
create table if not exists public.rounds (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games (id) on delete cascade,
  title       text not null,
  order_index integer not null default 0
);
create index if not exists rounds_game_id_idx on public.rounds (game_id);

-- ---------------------------------------------------------------------------
-- questions: belong to a game and optionally to a round.
-- correct_option_id FK is added after question_options exists (below).
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id                uuid primary key default gen_random_uuid(),
  game_id           uuid not null references public.games (id) on delete cascade,
  round_id          uuid references public.rounds (id) on delete set null,
  text              text not null,
  points            integer not null default 1 check (points > 0),
  order_index       integer not null default 0,
  correct_option_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists questions_game_id_idx on public.questions (game_id);
create index if not exists questions_round_id_idx on public.questions (round_id);

-- ---------------------------------------------------------------------------
-- question_options: at least two per question (enforced in the app layer);
-- the schema does not hard-code any specific number of options.
-- ---------------------------------------------------------------------------
create table if not exists public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  text        text not null,
  order_index integer not null default 0
);
create index if not exists question_options_question_id_idx
  on public.question_options (question_id);

-- Now wire up the correct-option foreign key. ON DELETE SET NULL so removing an
-- option clears the reference rather than deleting the question.
alter table public.questions
  drop constraint if exists questions_correct_option_id_fkey;
alter table public.questions
  add constraint questions_correct_option_id_fkey
  foreign key (correct_option_id)
  references public.question_options (id) on delete set null;

-- ---------------------------------------------------------------------------
-- tiebreakers: at most one per game.
-- ---------------------------------------------------------------------------
create table if not exists public.tiebreakers (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null unique references public.games (id) on delete cascade,
  question_text text not null,
  correct_value numeric not null,
  unit_label    text,
  instructions  text
);

-- ---------------------------------------------------------------------------
-- game_sessions: one playthrough of a game template.
-- ---------------------------------------------------------------------------
create table if not exists public.game_sessions (
  id                  uuid primary key default gen_random_uuid(),
  game_id             uuid not null references public.games (id) on delete cascade,
  status              text not null default 'setup'
                        check (status in ('setup', 'active', 'tiebreaker', 'completed', 'cancelled')),
  current_question_id uuid references public.questions (id) on delete set null,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists game_sessions_game_id_idx on public.game_sessions (game_id);

-- ---------------------------------------------------------------------------
-- teams: participants in a session.
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id              uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions (id) on delete cascade,
  name            text not null,
  order_index     integer not null default 0
);
create index if not exists teams_session_idx on public.teams (game_session_id);

-- ---------------------------------------------------------------------------
-- team_answers: one answer per (session, question, team).
-- ---------------------------------------------------------------------------
create table if not exists public.team_answers (
  id                 uuid primary key default gen_random_uuid(),
  game_session_id    uuid not null references public.game_sessions (id) on delete cascade,
  question_id        uuid not null references public.questions (id) on delete cascade,
  team_id            uuid not null references public.teams (id) on delete cascade,
  selected_option_id uuid references public.question_options (id) on delete set null,
  is_correct         boolean not null default false,
  awarded_points     integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint team_answers_unique unique (game_session_id, question_id, team_id)
);
create index if not exists team_answers_session_idx on public.team_answers (game_session_id);
create index if not exists team_answers_question_idx on public.team_answers (question_id);

-- ---------------------------------------------------------------------------
-- tiebreaker_answers: one numeric answer per (session, team).
-- ---------------------------------------------------------------------------
create table if not exists public.tiebreaker_answers (
  id                  uuid primary key default gen_random_uuid(),
  game_session_id     uuid not null references public.game_sessions (id) on delete cascade,
  team_id             uuid not null references public.teams (id) on delete cascade,
  answer_value        numeric not null,
  absolute_difference numeric,
  constraint tiebreaker_answers_unique unique (game_session_id, team_id)
);
create index if not exists tiebreaker_answers_session_idx
  on public.tiebreaker_answers (game_session_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance trigger.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

drop trigger if exists team_answers_set_updated_at on public.team_answers;
create trigger team_answers_set_updated_at
  before update on public.team_answers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up. Reads the
-- display_name supplied in the sign-up metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
