import type {
  Game,
  GameStatus,
  QuestionWithOptions,
  Round,
  Tiebreaker,
} from '@/types/models'

export interface AuthUser {
  id: string
  email: string | null
  displayName: string
}

/** Payload used to create/update a game's general settings. */
export interface GameSettingsInput {
  title: string
  description: string | null
  status: GameStatus
  public_scoreboard_enabled: boolean
}

/**
 * The full editable template as held by the editor. Ids are client-generated
 * UUIDs and are kept STABLE across saves so historical answers that reference a
 * question are never orphaned by an edit.
 */
export interface TemplateDraft {
  game: Game
  rounds: Round[]
  questions: QuestionWithOptions[]
  tiebreaker: Tiebreaker | null
}

export interface CreateSessionInput {
  gameId: string
  teamNames: string[]
}

/** A single answer to persist (upsert) at reveal time. */
export interface TeamAnswerInput {
  game_session_id: string
  question_id: string
  team_id: string
  selected_option_id: string | null
  is_correct: boolean
  awarded_points: number
}

export interface TiebreakerAnswerInput {
  game_session_id: string
  team_id: string
  answer_value: number
  absolute_difference: number | null
}
