-- =============================================================================
-- 0002_rls.sql — Row Level Security. Every table exposed via the Data API has
-- RLS enabled. Access rules:
--   * anonymous users may only read a session's public scoreboard, and only
--     when the game has public_scoreboard_enabled = true;
--   * authenticated admins may create/edit games, sessions and answers;
--   * only the owner of a game may modify it or its sessions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Ownership / visibility helper functions (SECURITY DEFINER avoids recursive
-- RLS evaluation when a policy needs to look at another table).
-- ---------------------------------------------------------------------------
create or replace function public.owns_game(game uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.games g
    where g.id = game and g.owner_id = auth.uid()
  );
$$;

create or replace function public.game_is_public(game uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.games g
    where g.id = game and g.public_scoreboard_enabled = true
  );
$$;

create or replace function public.owns_session(session uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.game_sessions gs
    join public.games g on g.id = gs.game_id
    where gs.id = session and g.owner_id = auth.uid()
  );
$$;

create or replace function public.session_is_public(session uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.game_sessions gs
    join public.games g on g.id = gs.game_id
    where gs.id = session and g.public_scoreboard_enabled = true
  );
$$;

create or replace function public.owns_question(question uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.questions q
    join public.games g on g.id = q.game_id
    where q.id = question and g.owner_id = auth.uid()
  );
$$;

create or replace function public.question_is_public(question uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.questions q
    join public.games g on g.id = q.game_id
    where q.id = question and g.public_scoreboard_enabled = true
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every table.
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.games             enable row level security;
alter table public.rounds            enable row level security;
alter table public.questions         enable row level security;
alter table public.question_options  enable row level security;
alter table public.tiebreakers       enable row level security;
alter table public.game_sessions     enable row level security;
alter table public.teams             enable row level security;
alter table public.team_answers      enable row level security;
alter table public.tiebreaker_answers enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
drop policy if exists games_select on public.games;
create policy games_select on public.games
  for select
  using (owner_id = auth.uid() or public_scoreboard_enabled = true);

drop policy if exists games_insert on public.games;
create policy games_insert on public.games
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists games_update on public.games;
create policy games_update on public.games
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists games_delete on public.games;
create policy games_delete on public.games
  for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- rounds
-- ---------------------------------------------------------------------------
drop policy if exists rounds_select on public.rounds;
create policy rounds_select on public.rounds
  for select using (owns_game(game_id) or game_is_public(game_id));

drop policy if exists rounds_write on public.rounds;
create policy rounds_write on public.rounds
  for all to authenticated using (owns_game(game_id)) with check (owns_game(game_id));

-- ---------------------------------------------------------------------------
-- questions (anon cannot read correct_option_id — see column grants below)
-- ---------------------------------------------------------------------------
drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
  for select using (owns_game(game_id) or game_is_public(game_id));

drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions
  for all to authenticated using (owns_game(game_id)) with check (owns_game(game_id));

-- ---------------------------------------------------------------------------
-- question_options
-- ---------------------------------------------------------------------------
drop policy if exists question_options_select on public.question_options;
create policy question_options_select on public.question_options
  for select using (owns_question(question_id) or question_is_public(question_id));

drop policy if exists question_options_write on public.question_options;
create policy question_options_write on public.question_options
  for all to authenticated
  using (owns_question(question_id)) with check (owns_question(question_id));

-- ---------------------------------------------------------------------------
-- tiebreakers
-- ---------------------------------------------------------------------------
drop policy if exists tiebreakers_select on public.tiebreakers;
create policy tiebreakers_select on public.tiebreakers
  for select using (owns_game(game_id) or game_is_public(game_id));

drop policy if exists tiebreakers_write on public.tiebreakers;
create policy tiebreakers_write on public.tiebreakers
  for all to authenticated using (owns_game(game_id)) with check (owns_game(game_id));

-- ---------------------------------------------------------------------------
-- game_sessions
-- ---------------------------------------------------------------------------
drop policy if exists sessions_select on public.game_sessions;
create policy sessions_select on public.game_sessions
  for select using (owns_session(id) or session_is_public(id));

drop policy if exists sessions_insert on public.game_sessions;
create policy sessions_insert on public.game_sessions
  for insert to authenticated with check (owns_game(game_id));

drop policy if exists sessions_update on public.game_sessions;
create policy sessions_update on public.game_sessions
  for update to authenticated using (owns_session(id)) with check (owns_session(id));

drop policy if exists sessions_delete on public.game_sessions;
create policy sessions_delete on public.game_sessions
  for delete to authenticated using (owns_session(id));

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select using (owns_session(game_session_id) or session_is_public(game_session_id));

drop policy if exists teams_write on public.teams;
create policy teams_write on public.teams
  for all to authenticated
  using (owns_session(game_session_id)) with check (owns_session(game_session_id));

-- ---------------------------------------------------------------------------
-- team_answers
-- ---------------------------------------------------------------------------
drop policy if exists team_answers_select on public.team_answers;
create policy team_answers_select on public.team_answers
  for select using (owns_session(game_session_id) or session_is_public(game_session_id));

drop policy if exists team_answers_write on public.team_answers;
create policy team_answers_write on public.team_answers
  for all to authenticated
  using (owns_session(game_session_id)) with check (owns_session(game_session_id));

-- ---------------------------------------------------------------------------
-- tiebreaker_answers
-- ---------------------------------------------------------------------------
drop policy if exists tiebreaker_answers_select on public.tiebreaker_answers;
create policy tiebreaker_answers_select on public.tiebreaker_answers
  for select using (owns_session(game_session_id) or session_is_public(game_session_id));

drop policy if exists tiebreaker_answers_write on public.tiebreaker_answers;
create policy tiebreaker_answers_write on public.tiebreaker_answers
  for all to authenticated
  using (owns_session(game_session_id)) with check (owns_session(game_session_id));

-- ---------------------------------------------------------------------------
-- Role grants. RLS governs which ROWS are visible; these grants govern which
-- TABLES/COLUMNS a role may touch at all.
--
-- authenticated: full DML (still constrained by the policies above).
-- anon: SELECT only, and on questions the correct_option_id column is
--       deliberately withheld so the audience can never see the answer early.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

grant select on
  public.games,
  public.rounds,
  public.question_options,
  public.tiebreakers,
  public.game_sessions,
  public.teams,
  public.team_answers,
  public.tiebreaker_answers
  to anon;

grant select
  (id, game_id, round_id, text, points, order_index, created_at, updated_at)
  on public.questions to anon;
