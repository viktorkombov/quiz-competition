// Domain models. These mirror the Supabase schema (snake_case columns) so the
// same shapes flow through the Supabase repository and the localStorage repo.

export type GameStatus = 'draft' | 'published' | 'archived'

export type SessionStatus = 'setup' | 'active' | 'tiebreaker' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  display_name: string
  created_at: string
}

export interface Game {
  id: string
  owner_id: string
  title: string
  description: string | null
  status: GameStatus
  public_scoreboard_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Round {
  id: string
  game_id: string
  title: string
  order_index: number
}

export interface QuestionOption {
  id: string
  question_id: string
  text: string
  order_index: number
}

export interface Question {
  id: string
  game_id: string
  round_id: string | null
  text: string
  points: number
  order_index: number
  correct_option_id: string | null
  created_at: string
  updated_at: string
}

export interface Tiebreaker {
  id: string
  game_id: string
  question_text: string
  correct_value: number
  unit_label: string | null
  instructions: string | null
}

export interface GameSession {
  id: string
  game_id: string
  status: SessionStatus
  current_question_id: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Team {
  id: string
  game_session_id: string
  name: string
  order_index: number
}

export interface TeamAnswer {
  id: string
  game_session_id: string
  question_id: string
  team_id: string
  selected_option_id: string | null
  is_correct: boolean
  awarded_points: number
  created_at: string
  updated_at: string
}

export interface TiebreakerAnswer {
  id: string
  game_session_id: string
  team_id: string
  answer_value: number
  absolute_difference: number | null
}

// ---------------------------------------------------------------------------
// Composed / aggregate shapes used by the UI.
// ---------------------------------------------------------------------------

export interface QuestionWithOptions extends Question {
  options: QuestionOption[]
}

export interface GameTemplate {
  game: Game
  rounds: Round[]
  questions: QuestionWithOptions[]
  tiebreaker: Tiebreaker | null
}

/** Lightweight dashboard summary for a game template. */
export interface GameSummary {
  game: Game
  questionCount: number
  roundCount: number
  hasTiebreaker: boolean
}

/** Everything needed to run and restore a session. */
export interface SessionState {
  session: GameSession
  template: GameTemplate
  teams: Team[]
  answers: TeamAnswer[]
  tiebreakerAnswers: TiebreakerAnswer[]
}
