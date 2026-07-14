-- =============================================================================
-- 0003_functions_views.sql — Convenience view and realtime configuration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- session_scoreboard: aggregated total points per team per session.
--
-- The frontend computes ranking in pure TypeScript, but this view is a handy
-- server-side aggregate for reporting/debugging. security_invoker = on makes it
-- respect the RLS policies of the querying user on the underlying tables.
-- ---------------------------------------------------------------------------
create or replace view public.session_scoreboard
with (security_invoker = on) as
select
  t.game_session_id,
  t.id                                    as team_id,
  t.name                                  as team_name,
  coalesce(sum(ta.awarded_points), 0)::int as total_points
from public.teams t
left join public.team_answers ta
  on ta.team_id = t.id
 and ta.game_session_id = t.game_session_id
group by t.game_session_id, t.id, t.name;

grant select on public.session_scoreboard to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: publish the tables the public scoreboard and host screen watch, so
-- state changes propagate to viewers without polling. Guarded so re-running the
-- migration is safe.
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tbl in array array['game_sessions', 'team_answers', 'teams', 'tiebreaker_answers']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = tbl
      ) then
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      end if;
    end loop;
  end if;
end $$;
