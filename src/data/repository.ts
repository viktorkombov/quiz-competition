import type {
  GameSession,
  GameSummary,
  GameTemplate,
  SessionStatus,
  SessionState,
  Team,
} from '@/types/models'
import type {
  AuthUser,
  CreateSessionInput,
  GameSettingsInput,
  TeamAnswerInput,
  TemplateDraft,
  TiebreakerAnswerInput,
} from './types'

export interface SessionSummary {
  session: GameSession
  gameTitle: string
  teamCount: number
}

/**
 * The single abstraction the whole UI talks to. Two implementations exist:
 * a Supabase-backed one and a localStorage demo one. They are interchangeable.
 */
export interface Repository {
  /** True for the localStorage demo implementation. */
  readonly isLocal: boolean

  // --- Auth --------------------------------------------------------------
  getCurrentUser(): Promise<AuthUser | null>
  signIn(email: string, password: string): Promise<AuthUser>
  signUp(email: string, password: string, displayName: string): Promise<AuthUser>
  signOut(): Promise<void>
  /** Subscribe to auth changes; returns an unsubscribe function. */
  onAuthChange(callback: (user: AuthUser | null) => void): () => void

  // --- Games (templates) -------------------------------------------------
  listGameSummaries(ownerId: string): Promise<GameSummary[]>
  getTemplate(gameId: string): Promise<GameTemplate | null>
  createGame(ownerId: string, settings: GameSettingsInput): Promise<string>
  /** Persist the full template (stable ids, sync semantics). */
  saveTemplate(draft: TemplateDraft): Promise<void>
  duplicateGame(gameId: string, ownerId: string): Promise<string>
  archiveGame(gameId: string): Promise<void>
  /** Delete a game. Rejects when sessions exist (history protection). */
  deleteGame(gameId: string): Promise<void>
  /** Number of sessions referencing a game (used to gate deletion). */
  countSessions(gameId: string): Promise<number>

  // --- Sessions ----------------------------------------------------------
  listSessions(ownerId: string): Promise<SessionSummary[]>
  createSession(input: CreateSessionInput): Promise<string>
  getSessionState(sessionId: string): Promise<SessionState | null>
  /** Public read: only succeeds when the game enables public scoreboard. */
  getPublicSessionState(sessionId: string): Promise<SessionState | null>
  updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void>
  setCurrentQuestion(sessionId: string, questionId: string | null): Promise<void>
  deleteSession(sessionId: string): Promise<void>

  // --- Teams (session setup) --------------------------------------------
  replaceTeams(sessionId: string, teamNames: string[]): Promise<Team[]>

  // --- Answers -----------------------------------------------------------
  /** Idempotent upsert keyed by (session, question, team). */
  upsertTeamAnswers(answers: TeamAnswerInput[]): Promise<void>
  upsertTiebreakerAnswers(answers: TiebreakerAnswerInput[]): Promise<void>

  // --- Realtime ----------------------------------------------------------
  /** Subscribe to session changes; returns an unsubscribe function. */
  subscribeToSession(sessionId: string, onChange: () => void): () => void
}
