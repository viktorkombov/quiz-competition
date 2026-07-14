import type {
  Game,
  GameSession,
  GameSummary,
  GameTemplate,
  Profile,
  Question,
  QuestionOption,
  QuestionWithOptions,
  Round,
  SessionState,
  SessionStatus,
  Team,
  TeamAnswer,
  Tiebreaker,
  TiebreakerAnswer,
} from '@/types/models'
import { createId } from '@/lib/utils'
import type { Repository, SessionSummary } from './repository'
import type {
  AuthUser,
  CreateSessionInput,
  GameSettingsInput,
  TeamAnswerInput,
  TemplateDraft,
  TiebreakerAnswerInput,
} from './types'
import { buildSeedData } from './seed'

const STORAGE_KEY = 'quiz-competition-local-db'
const EVENT_NAME = 'quiz-local-db-change'

export interface LocalUser {
  id: string
  email: string
  password: string
  displayName: string
}

export interface LocalDB {
  users: LocalUser[]
  currentUserId: string | null
  profiles: Profile[]
  games: Game[]
  rounds: Round[]
  questions: Question[]
  options: QuestionOption[]
  tiebreakers: Tiebreaker[]
  sessions: GameSession[]
  teams: Team[]
  answers: TeamAnswer[]
  tiebreakerAnswers: TiebreakerAnswer[]
}

function nowIso(): string {
  return new Date().toISOString()
}

function emptyDB(): LocalDB {
  return {
    users: [],
    currentUserId: null,
    profiles: [],
    games: [],
    rounds: [],
    questions: [],
    options: [],
    tiebreakers: [],
    sessions: [],
    teams: [],
    answers: [],
    tiebreakerAnswers: [],
  }
}

export class LocalRepository implements Repository {
  readonly isLocal = true
  private authListeners = new Set<(user: AuthUser | null) => void>()

  constructor() {
    this.ensureSeed()
  }

  // ---- persistence ------------------------------------------------------
  private read(): LocalDB {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return emptyDB()
      return { ...emptyDB(), ...(JSON.parse(raw) as LocalDB) }
    } catch {
      return emptyDB()
    }
  }

  private write(db: LocalDB): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    // Notify same-tab subscribers (storage event only fires cross-tab).
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  }

  private ensureSeed(): void {
    const db = this.read()
    if (db.games.length === 0 && db.users.length === 0) {
      this.write(buildSeedData())
    }
  }

  private toAuthUser(user: LocalUser | undefined | null): AuthUser | null {
    if (!user) return null
    return { id: user.id, email: user.email, displayName: user.displayName }
  }

  private notifyAuth(user: AuthUser | null): void {
    for (const cb of this.authListeners) cb(user)
  }

  // ---- auth -------------------------------------------------------------
  async getCurrentUser(): Promise<AuthUser | null> {
    const db = this.read()
    return this.toAuthUser(db.users.find((u) => u.id === db.currentUserId))
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const db = this.read()
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    if (!user || user.password !== password) {
      throw new Error('Невалиден имейл или парола.')
    }
    db.currentUserId = user.id
    this.write(db)
    const authUser = this.toAuthUser(user)!
    this.notifyAuth(authUser)
    return authUser
  }

  async signUp(email: string, password: string, displayName: string): Promise<AuthUser> {
    const db = this.read()
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Вече съществува потребител с този имейл.')
    }
    const id = createId()
    const user: LocalUser = { id, email, password, displayName }
    db.users.push(user)
    db.profiles.push({ id, display_name: displayName, created_at: nowIso() })
    db.currentUserId = id
    this.write(db)
    const authUser = this.toAuthUser(user)!
    this.notifyAuth(authUser)
    return authUser
  }

  async signOut(): Promise<void> {
    const db = this.read()
    db.currentUserId = null
    this.write(db)
    this.notifyAuth(null)
  }

  onAuthChange(callback: (user: AuthUser | null) => void): () => void {
    this.authListeners.add(callback)
    return () => this.authListeners.delete(callback)
  }

  // ---- games ------------------------------------------------------------
  async listGameSummaries(ownerId: string): Promise<GameSummary[]> {
    const db = this.read()
    return db.games
      .filter((g) => g.owner_id === ownerId)
      .map((game) => ({
        game,
        questionCount: db.questions.filter((q) => q.game_id === game.id).length,
        roundCount: db.rounds.filter((r) => r.game_id === game.id).length,
        hasTiebreaker: db.tiebreakers.some((t) => t.game_id === game.id),
      }))
      .sort((a, b) => b.game.updated_at.localeCompare(a.game.updated_at))
  }

  async getTemplate(gameId: string): Promise<GameTemplate | null> {
    const db = this.read()
    return this.buildTemplate(db, gameId)
  }

  private buildTemplate(db: LocalDB, gameId: string): GameTemplate | null {
    const game = db.games.find((g) => g.id === gameId)
    if (!game) return null
    const rounds = db.rounds
      .filter((r) => r.game_id === gameId)
      .sort((a, b) => a.order_index - b.order_index)
    const questions: QuestionWithOptions[] = db.questions
      .filter((q) => q.game_id === gameId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((q) => ({
        ...q,
        options: db.options
          .filter((o) => o.question_id === q.id)
          .sort((a, b) => a.order_index - b.order_index),
      }))
    const tiebreaker = db.tiebreakers.find((t) => t.game_id === gameId) ?? null
    return { game, rounds, questions, tiebreaker }
  }

  async createGame(ownerId: string, settings: GameSettingsInput): Promise<string> {
    const db = this.read()
    const id = createId()
    const ts = nowIso()
    db.games.push({
      id,
      owner_id: ownerId,
      title: settings.title,
      description: settings.description,
      status: settings.status,
      public_scoreboard_enabled: settings.public_scoreboard_enabled,
      created_at: ts,
      updated_at: ts,
    })
    this.write(db)
    return id
  }

  async saveTemplate(draft: TemplateDraft): Promise<void> {
    const db = this.read()
    const gameId = draft.game.id
    const idx = db.games.findIndex((g) => g.id === gameId)
    const game: Game = { ...draft.game, updated_at: nowIso() }
    if (idx >= 0) db.games[idx] = game
    else db.games.push(game)

    // Sync rounds.
    db.rounds = db.rounds.filter((r) => r.game_id !== gameId)
    db.rounds.push(...draft.rounds.map((r) => ({ ...r, game_id: gameId })))

    // Sync questions + options (stable ids preserve historical answers).
    const keepQuestionIds = new Set(draft.questions.map((q) => q.id))
    // Remove questions of this game that are no longer present.
    const removedQuestionIds = db.questions
      .filter((q) => q.game_id === gameId && !keepQuestionIds.has(q.id))
      .map((q) => q.id)
    db.questions = db.questions.filter(
      (q) => q.game_id !== gameId || keepQuestionIds.has(q.id),
    )
    db.options = db.options.filter((o) => !removedQuestionIds.includes(o.question_id))
    // Cascade: drop answers for removed questions (explicit user removal).
    db.answers = db.answers.filter((a) => !removedQuestionIds.includes(a.question_id))

    for (const q of draft.questions) {
      const { options, ...question } = q
      const existing = db.questions.findIndex((x) => x.id === q.id)
      const record: Question = { ...question, game_id: gameId, updated_at: nowIso() }
      if (existing >= 0) db.questions[existing] = record
      else db.questions.push(record)
      // Replace options for this question.
      db.options = db.options.filter((o) => o.question_id !== q.id)
      db.options.push(...options.map((o) => ({ ...o, question_id: q.id })))
    }

    // Sync tiebreaker.
    db.tiebreakers = db.tiebreakers.filter((t) => t.game_id !== gameId)
    if (draft.tiebreaker) {
      db.tiebreakers.push({ ...draft.tiebreaker, game_id: gameId })
    }

    this.write(db)
  }

  async duplicateGame(gameId: string, ownerId: string): Promise<string> {
    const db = this.read()
    const template = this.buildTemplate(db, gameId)
    if (!template) throw new Error('Играта не е намерена.')

    const newGameId = createId()
    const ts = nowIso()
    db.games.push({
      ...template.game,
      id: newGameId,
      owner_id: ownerId,
      title: `${template.game.title} (копие)`,
      status: 'draft',
      created_at: ts,
      updated_at: ts,
    })

    const roundIdMap = new Map<string, string>()
    for (const r of template.rounds) {
      const newId = createId()
      roundIdMap.set(r.id, newId)
      db.rounds.push({ ...r, id: newId, game_id: newGameId })
    }
    for (const q of template.questions) {
      const newQId = createId()
      const optionIdMap = new Map<string, string>()
      for (const o of q.options) {
        const newOId = createId()
        optionIdMap.set(o.id, newOId)
        db.options.push({ ...o, id: newOId, question_id: newQId })
      }
      const { options: _options, ...flat } = q
      const cloned: Question = {
        ...flat,
        id: newQId,
        game_id: newGameId,
        round_id: q.round_id ? (roundIdMap.get(q.round_id) ?? null) : null,
        correct_option_id: q.correct_option_id
          ? (optionIdMap.get(q.correct_option_id) ?? null)
          : null,
        created_at: ts,
        updated_at: ts,
      }
      db.questions.push(cloned)
    }
    if (template.tiebreaker) {
      db.tiebreakers.push({ ...template.tiebreaker, id: createId(), game_id: newGameId })
    }

    this.write(db)
    return newGameId
  }

  async archiveGame(gameId: string): Promise<void> {
    const db = this.read()
    const game = db.games.find((g) => g.id === gameId)
    if (game) {
      game.status = 'archived'
      game.updated_at = nowIso()
      this.write(db)
    }
  }

  async countSessions(gameId: string): Promise<number> {
    const db = this.read()
    return db.sessions.filter((s) => s.game_id === gameId).length
  }

  async deleteGame(gameId: string): Promise<void> {
    const db = this.read()
    const sessionCount = db.sessions.filter((s) => s.game_id === gameId).length
    if (sessionCount > 0) {
      throw new Error(
        'Играта има изиграни сесии в историята. Архивирайте я вместо да я изтривате.',
      )
    }
    const questionIds = db.questions.filter((q) => q.game_id === gameId).map((q) => q.id)
    db.games = db.games.filter((g) => g.id !== gameId)
    db.rounds = db.rounds.filter((r) => r.game_id !== gameId)
    db.questions = db.questions.filter((q) => q.game_id !== gameId)
    db.options = db.options.filter((o) => !questionIds.includes(o.question_id))
    db.tiebreakers = db.tiebreakers.filter((t) => t.game_id !== gameId)
    this.write(db)
  }

  // ---- sessions ---------------------------------------------------------
  async listSessions(ownerId: string): Promise<SessionSummary[]> {
    const db = this.read()
    const ownedGameIds = new Set(
      db.games.filter((g) => g.owner_id === ownerId).map((g) => g.id),
    )
    return db.sessions
      .filter((s) => ownedGameIds.has(s.game_id))
      .map((session) => ({
        session,
        gameTitle: db.games.find((g) => g.id === session.game_id)?.title ?? '—',
        teamCount: db.teams.filter((t) => t.game_session_id === session.id).length,
      }))
      .sort((a, b) => b.session.created_at.localeCompare(a.session.created_at))
  }

  async createSession(input: CreateSessionInput): Promise<string> {
    const db = this.read()
    const id = createId()
    const ts = nowIso()
    db.sessions.push({
      id,
      game_id: input.gameId,
      status: 'setup',
      current_question_id: null,
      started_at: null,
      completed_at: null,
      created_at: ts,
    })
    input.teamNames.forEach((name, index) => {
      db.teams.push({
        id: createId(),
        game_session_id: id,
        name,
        order_index: index,
      })
    })
    this.write(db)
    return id
  }

  private buildSessionState(db: LocalDB, sessionId: string): SessionState | null {
    const session = db.sessions.find((s) => s.id === sessionId)
    if (!session) return null
    const template = this.buildTemplate(db, session.game_id)
    if (!template) return null
    const teams = db.teams
      .filter((t) => t.game_session_id === sessionId)
      .sort((a, b) => a.order_index - b.order_index)
    const answers = db.answers.filter((a) => a.game_session_id === sessionId)
    const tiebreakerAnswers = db.tiebreakerAnswers.filter(
      (t) => t.game_session_id === sessionId,
    )
    return { session, template, teams, answers, tiebreakerAnswers }
  }

  async getSessionState(sessionId: string): Promise<SessionState | null> {
    return this.buildSessionState(this.read(), sessionId)
  }

  async getPublicSessionState(sessionId: string): Promise<SessionState | null> {
    const db = this.read()
    const state = this.buildSessionState(db, sessionId)
    if (!state) return null
    if (!state.template.game.public_scoreboard_enabled) return null
    return state
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
    const db = this.read()
    const session = db.sessions.find((s) => s.id === sessionId)
    if (!session) return
    session.status = status
    if (status === 'active' && !session.started_at) session.started_at = nowIso()
    if (status === 'completed' || status === 'cancelled') session.completed_at = nowIso()
    this.write(db)
  }

  async setCurrentQuestion(sessionId: string, questionId: string | null): Promise<void> {
    const db = this.read()
    const session = db.sessions.find((s) => s.id === sessionId)
    if (!session) return
    session.current_question_id = questionId
    this.write(db)
  }

  async deleteSession(sessionId: string): Promise<void> {
    const db = this.read()
    db.sessions = db.sessions.filter((s) => s.id !== sessionId)
    db.teams = db.teams.filter((t) => t.game_session_id !== sessionId)
    db.answers = db.answers.filter((a) => a.game_session_id !== sessionId)
    db.tiebreakerAnswers = db.tiebreakerAnswers.filter(
      (t) => t.game_session_id !== sessionId,
    )
    this.write(db)
  }

  async replaceTeams(sessionId: string, teamNames: string[]): Promise<Team[]> {
    const db = this.read()
    db.teams = db.teams.filter((t) => t.game_session_id !== sessionId)
    const teams: Team[] = teamNames.map((name, index) => ({
      id: createId(),
      game_session_id: sessionId,
      name,
      order_index: index,
    }))
    db.teams.push(...teams)
    this.write(db)
    return teams
  }

  // ---- answers ----------------------------------------------------------
  async upsertTeamAnswers(inputs: TeamAnswerInput[]): Promise<void> {
    if (inputs.length === 0) return
    const db = this.read()
    const ts = nowIso()
    for (const input of inputs) {
      const existing = db.answers.find(
        (a) =>
          a.game_session_id === input.game_session_id &&
          a.question_id === input.question_id &&
          a.team_id === input.team_id,
      )
      if (existing) {
        existing.selected_option_id = input.selected_option_id
        existing.is_correct = input.is_correct
        existing.awarded_points = input.awarded_points
        existing.updated_at = ts
      } else {
        db.answers.push({
          id: createId(),
          ...input,
          created_at: ts,
          updated_at: ts,
        })
      }
    }
    this.write(db)
  }

  async upsertTiebreakerAnswers(inputs: TiebreakerAnswerInput[]): Promise<void> {
    if (inputs.length === 0) return
    const db = this.read()
    for (const input of inputs) {
      const existing = db.tiebreakerAnswers.find(
        (a) => a.game_session_id === input.game_session_id && a.team_id === input.team_id,
      )
      if (existing) {
        existing.answer_value = input.answer_value
        existing.absolute_difference = input.absolute_difference
      } else {
        db.tiebreakerAnswers.push({ id: createId(), ...input })
      }
    }
    this.write(db)
  }

  // ---- realtime (same-tab + cross-tab via storage event) ---------------
  subscribeToSession(_sessionId: string, onChange: () => void): () => void {
    const handler = () => onChange()
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) onChange()
    }
    window.addEventListener(EVENT_NAME, handler)
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      window.removeEventListener('storage', storageHandler)
    }
  }
}
