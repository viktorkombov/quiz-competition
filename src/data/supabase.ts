import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Game,
  GameSession,
  GameSummary,
  GameTemplate,
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
import type { Repository, SessionSummary } from './repository'
import type {
  AuthUser,
  CreateSessionInput,
  GameSettingsInput,
  TeamAnswerInput,
  TemplateDraft,
  TiebreakerAnswerInput,
} from './types'

/** Repository implementation backed by Supabase (PostgREST + Auth + Realtime). */
export class SupabaseRepository implements Repository {
  readonly isLocal = false

  constructor(private readonly client: SupabaseClient) {}

  private fail(message: string, error: { message: string } | null): never {
    throw new Error(error ? `${message}: ${error.message}` : message)
  }

  // ---- auth -------------------------------------------------------------
  async getCurrentUser(): Promise<AuthUser | null> {
    const { data } = await this.client.auth.getUser()
    if (!data.user) return null
    return this.toAuthUser(data.user.id, data.user.email ?? null)
  }

  private async toAuthUser(id: string, email: string | null): Promise<AuthUser> {
    const { data } = await this.client
      .from('profiles')
      .select('display_name')
      .eq('id', id)
      .maybeSingle()
    return { id, email, displayName: data?.display_name ?? email ?? 'Администратор' }
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password })
    if (error || !data.user) this.fail('Неуспешно влизане', error)
    return this.toAuthUser(data.user.id, data.user.email ?? null)
  }

  async signUp(email: string, password: string, displayName: string): Promise<AuthUser> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error || !data.user) this.fail('Неуспешна регистрация', error)
    // The profiles row is created by a database trigger (see migrations).
    return { id: data.user.id, email: data.user.email ?? null, displayName }
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut()
  }

  onAuthChange(callback: (user: AuthUser | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        callback(null)
        return
      }
      void this.toAuthUser(session.user.id, session.user.email ?? null).then(callback)
    })
    return () => data.subscription.unsubscribe()
  }

  // ---- games ------------------------------------------------------------
  async listGameSummaries(ownerId: string): Promise<GameSummary[]> {
    const { data: games, error } = await this.client
      .from('games')
      .select('*')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false })
    if (error) this.fail('Грешка при зареждане на игрите', error)

    const gameRows = (games ?? []) as Game[]
    if (gameRows.length === 0) return []

    const ids = gameRows.map((g) => g.id)
    const [{ data: questions }, { data: rounds }, { data: tbs }] = await Promise.all([
      this.client.from('questions').select('id, game_id').in('game_id', ids),
      this.client.from('rounds').select('id, game_id').in('game_id', ids),
      this.client.from('tiebreakers').select('id, game_id').in('game_id', ids),
    ])

    return gameRows.map((game) => ({
      game,
      questionCount: (questions ?? []).filter((q) => q.game_id === game.id).length,
      roundCount: (rounds ?? []).filter((r) => r.game_id === game.id).length,
      hasTiebreaker: (tbs ?? []).some((t) => t.game_id === game.id),
    }))
  }

  async getTemplate(gameId: string): Promise<GameTemplate | null> {
    const { data: game, error } = await this.client
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle()
    if (error) this.fail('Грешка при зареждане на играта', error)
    if (!game) return null
    return this.assembleTemplate(game as Game)
  }

  private async assembleTemplate(game: Game): Promise<GameTemplate> {
    const [{ data: rounds }, { data: questions }, { data: tiebreaker }] = await Promise.all([
      this.client.from('rounds').select('*').eq('game_id', game.id).order('order_index'),
      this.client.from('questions').select('*').eq('game_id', game.id).order('order_index'),
      this.client.from('tiebreakers').select('*').eq('game_id', game.id).maybeSingle(),
    ])

    const questionRowsRaw = (questions ?? []) as Question[]
    const questionIds = questionRowsRaw.map((q) => q.id)

    let optionRows: QuestionOption[] = []
    if (questionIds.length > 0) {
      const { data: options } = await this.client
        .from('question_options')
        .select('*')
        .in('question_id', questionIds)
      optionRows = (options ?? []) as QuestionOption[]
    }

    const questionRows: QuestionWithOptions[] = questionRowsRaw.map((q) => ({
      ...q,
      options: optionRows
        .filter((o) => o.question_id === q.id)
        .sort((a, b) => a.order_index - b.order_index),
    }))

    return {
      game,
      rounds: (rounds ?? []) as Round[],
      questions: questionRows,
      tiebreaker: (tiebreaker as Tiebreaker | null) ?? null,
    }
  }

  async createGame(ownerId: string, settings: GameSettingsInput): Promise<string> {
    const { data, error } = await this.client
      .from('games')
      .insert({ owner_id: ownerId, ...settings })
      .select('id')
      .single()
    if (error || !data) this.fail('Грешка при създаване на играта', error)
    return data.id as string
  }

  async saveTemplate(draft: TemplateDraft): Promise<void> {
    const gameId = draft.game.id

    // 1. Update game settings.
    const { error: gameError } = await this.client
      .from('games')
      .update({
        title: draft.game.title,
        description: draft.game.description,
        status: draft.game.status,
        public_scoreboard_enabled: draft.game.public_scoreboard_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId)
    if (gameError) this.fail('Грешка при запис на играта', gameError)

    // 2. Sync rounds (delete removed, upsert current).
    const { data: existingRounds } = await this.client
      .from('rounds')
      .select('id')
      .eq('game_id', gameId)
    const keptRoundIds = new Set(draft.rounds.map((r) => r.id))
    const removedRounds = (existingRounds ?? [])
      .map((r) => r.id as string)
      .filter((id) => !keptRoundIds.has(id))
    if (removedRounds.length > 0) {
      await this.client.from('rounds').delete().in('id', removedRounds)
    }
    if (draft.rounds.length > 0) {
      const { error } = await this.client.from('rounds').upsert(
        draft.rounds.map((r) => ({
          id: r.id,
          game_id: gameId,
          title: r.title,
          order_index: r.order_index,
        })),
      )
      if (error) this.fail('Грешка при запис на кръговете', error)
    }

    // 3. Sync questions (delete removed, then upsert). Options are synced after
    //    so that correct_option_id references exist.
    const { data: existingQuestions } = await this.client
      .from('questions')
      .select('id')
      .eq('game_id', gameId)
    const keptQuestionIds = new Set(draft.questions.map((q) => q.id))
    const removedQuestions = (existingQuestions ?? [])
      .map((q) => q.id as string)
      .filter((id) => !keptQuestionIds.has(id))
    if (removedQuestions.length > 0) {
      await this.client.from('questions').delete().in('id', removedQuestions)
    }

    // Upsert questions with correct_option_id temporarily null to avoid FK
    // ordering issues, then upsert options, then set the correct option.
    if (draft.questions.length > 0) {
      const { error: qErr } = await this.client.from('questions').upsert(
        draft.questions.map((q) => ({
          id: q.id,
          game_id: gameId,
          round_id: q.round_id,
          text: q.text,
          points: q.points,
          order_index: q.order_index,
          correct_option_id: null,
          updated_at: new Date().toISOString(),
        })),
      )
      if (qErr) this.fail('Грешка при запис на въпросите', qErr)

      // Sync options per question.
      for (const q of draft.questions) {
        const { data: existingOpts } = await this.client
          .from('question_options')
          .select('id')
          .eq('question_id', q.id)
        const keptOptIds = new Set(q.options.map((o) => o.id))
        const removedOpts = (existingOpts ?? [])
          .map((o) => o.id as string)
          .filter((id) => !keptOptIds.has(id))
        if (removedOpts.length > 0) {
          await this.client.from('question_options').delete().in('id', removedOpts)
        }
        if (q.options.length > 0) {
          const { error: oErr } = await this.client.from('question_options').upsert(
            q.options.map((o) => ({
              id: o.id,
              question_id: q.id,
              text: o.text,
              order_index: o.order_index,
            })),
          )
          if (oErr) this.fail('Грешка при запис на отговорите', oErr)
        }
      }

      // Now set correct_option_id.
      for (const q of draft.questions) {
        const { error: cErr } = await this.client
          .from('questions')
          .update({ correct_option_id: q.correct_option_id })
          .eq('id', q.id)
        if (cErr) this.fail('Грешка при запис на верния отговор', cErr)
      }
    }

    // 4. Sync tiebreaker.
    await this.client.from('tiebreakers').delete().eq('game_id', gameId)
    if (draft.tiebreaker) {
      const { error } = await this.client.from('tiebreakers').insert({
        id: draft.tiebreaker.id,
        game_id: gameId,
        question_text: draft.tiebreaker.question_text,
        correct_value: draft.tiebreaker.correct_value,
        unit_label: draft.tiebreaker.unit_label,
        instructions: draft.tiebreaker.instructions,
      })
      if (error) this.fail('Грешка при запис на тайбрекъра', error)
    }
  }

  async duplicateGame(gameId: string, ownerId: string): Promise<string> {
    const template = await this.getTemplate(gameId)
    if (!template) this.fail('Играта не е намерена', null)

    const newGameId = await this.createGame(ownerId, {
      title: `${template.game.title} (копие)`,
      description: template.game.description,
      status: 'draft',
      public_scoreboard_enabled: template.game.public_scoreboard_enabled,
    })

    // Re-key rounds/questions/options with fresh ids and save as a new draft.
    const roundIdMap = new Map<string, string>()
    const rounds: Round[] = template.rounds.map((r) => {
      const id = crypto.randomUUID()
      roundIdMap.set(r.id, id)
      return { ...r, id, game_id: newGameId }
    })
    const questions: QuestionWithOptions[] = template.questions.map((q) => {
      const newQId = crypto.randomUUID()
      const optIdMap = new Map<string, string>()
      const options: QuestionOption[] = q.options.map((o) => {
        const id = crypto.randomUUID()
        optIdMap.set(o.id, id)
        return { ...o, id, question_id: newQId }
      })
      return {
        ...q,
        id: newQId,
        game_id: newGameId,
        round_id: q.round_id ? (roundIdMap.get(q.round_id) ?? null) : null,
        correct_option_id: q.correct_option_id
          ? (optIdMap.get(q.correct_option_id) ?? null)
          : null,
        options,
      }
    })
    const tiebreaker: Tiebreaker | null = template.tiebreaker
      ? { ...template.tiebreaker, id: crypto.randomUUID(), game_id: newGameId }
      : null

    const { data: newGame } = await this.client
      .from('games')
      .select('*')
      .eq('id', newGameId)
      .single()

    await this.saveTemplate({
      game: newGame as Game,
      rounds,
      questions,
      tiebreaker,
    })
    return newGameId
  }

  async archiveGame(gameId: string): Promise<void> {
    const { error } = await this.client
      .from('games')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', gameId)
    if (error) this.fail('Грешка при архивиране', error)
  }

  async countSessions(gameId: string): Promise<number> {
    const { count, error } = await this.client
      .from('game_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId)
    if (error) this.fail('Грешка при проверка на сесиите', error)
    return count ?? 0
  }

  async deleteGame(gameId: string): Promise<void> {
    const count = await this.countSessions(gameId)
    if (count > 0) {
      throw new Error(
        'Играта има изиграни сесии в историята. Архивирайте я вместо да я изтривате.',
      )
    }
    const { error } = await this.client.from('games').delete().eq('id', gameId)
    if (error) this.fail('Грешка при изтриване на играта', error)
  }

  // ---- sessions ---------------------------------------------------------
  async listSessions(ownerId: string): Promise<SessionSummary[]> {
    const { data: games } = await this.client
      .from('games')
      .select('id, title')
      .eq('owner_id', ownerId)
    const gameRows = (games ?? []) as { id: string; title: string }[]
    if (gameRows.length === 0) return []
    const gameIds = gameRows.map((g) => g.id)

    const { data: sessions, error } = await this.client
      .from('game_sessions')
      .select('*')
      .in('game_id', gameIds)
      .order('created_at', { ascending: false })
    if (error) this.fail('Грешка при зареждане на сесиите', error)
    const sessionRows = (sessions ?? []) as GameSession[]

    const { data: teams } = await this.client
      .from('teams')
      .select('id, game_session_id')
      .in(
        'game_session_id',
        sessionRows.map((s) => s.id),
      )

    return sessionRows.map((session) => ({
      session,
      gameTitle: gameRows.find((g) => g.id === session.game_id)?.title ?? '—',
      teamCount: (teams ?? []).filter((t) => t.game_session_id === session.id).length,
    }))
  }

  async createSession(input: CreateSessionInput): Promise<string> {
    const { data, error } = await this.client
      .from('game_sessions')
      .insert({ game_id: input.gameId, status: 'setup' })
      .select('id')
      .single()
    if (error || !data) this.fail('Грешка при създаване на сесия', error)
    const sessionId = data.id as string
    if (input.teamNames.length > 0) {
      await this.client.from('teams').insert(
        input.teamNames.map((name, index) => ({
          game_session_id: sessionId,
          name,
          order_index: index,
        })),
      )
    }
    return sessionId
  }

  private async assembleSessionState(session: GameSession): Promise<SessionState> {
    const template = await this.assembleTemplate(
      (
        await this.client.from('games').select('*').eq('id', session.game_id).single()
      ).data as Game,
    )
    const [{ data: teams }, { data: answers }, { data: tbAnswers }] = await Promise.all([
      this.client
        .from('teams')
        .select('*')
        .eq('game_session_id', session.id)
        .order('order_index'),
      this.client.from('team_answers').select('*').eq('game_session_id', session.id),
      this.client
        .from('tiebreaker_answers')
        .select('*')
        .eq('game_session_id', session.id),
    ])
    return {
      session,
      template,
      teams: (teams ?? []) as Team[],
      answers: (answers ?? []) as TeamAnswer[],
      tiebreakerAnswers: (tbAnswers ?? []) as TiebreakerAnswer[],
    }
  }

  async getSessionState(sessionId: string): Promise<SessionState | null> {
    const { data, error } = await this.client
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()
    if (error) this.fail('Грешка при зареждане на сесията', error)
    if (!data) return null
    return this.assembleSessionState(data as GameSession)
  }

  async getPublicSessionState(sessionId: string): Promise<SessionState | null> {
    // RLS ensures this only returns rows for games with public scoreboard on.
    return this.getSessionState(sessionId)
  }

  async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
    const patch: Record<string, unknown> = { status }
    if (status === 'active') patch.started_at = new Date().toISOString()
    if (status === 'completed' || status === 'cancelled')
      patch.completed_at = new Date().toISOString()
    const { error } = await this.client
      .from('game_sessions')
      .update(patch)
      .eq('id', sessionId)
    if (error) this.fail('Грешка при обновяване на сесията', error)
  }

  async setCurrentQuestion(sessionId: string, questionId: string | null): Promise<void> {
    const { error } = await this.client
      .from('game_sessions')
      .update({ current_question_id: questionId })
      .eq('id', sessionId)
    if (error) this.fail('Грешка при смяна на въпроса', error)
  }

  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('game_sessions')
      .delete()
      .eq('id', sessionId)
    if (error) this.fail('Грешка при изтриване на сесията', error)
  }

  async replaceTeams(sessionId: string, teamNames: string[]): Promise<Team[]> {
    await this.client.from('teams').delete().eq('game_session_id', sessionId)
    if (teamNames.length === 0) return []
    const { data, error } = await this.client
      .from('teams')
      .insert(
        teamNames.map((name, index) => ({
          game_session_id: sessionId,
          name,
          order_index: index,
        })),
      )
      .select('*')
    if (error) this.fail('Грешка при запис на отборите', error)
    return ((data ?? []) as Team[]).sort((a, b) => a.order_index - b.order_index)
  }

  // ---- answers ----------------------------------------------------------
  async upsertTeamAnswers(inputs: TeamAnswerInput[]): Promise<void> {
    if (inputs.length === 0) return
    const { error } = await this.client.from('team_answers').upsert(
      inputs.map((i) => ({ ...i, updated_at: new Date().toISOString() })),
      { onConflict: 'game_session_id,question_id,team_id' },
    )
    if (error) this.fail('Грешка при запис на отговорите', error)
  }

  async upsertTiebreakerAnswers(inputs: TiebreakerAnswerInput[]): Promise<void> {
    if (inputs.length === 0) return
    const { error } = await this.client.from('tiebreaker_answers').upsert(inputs, {
      onConflict: 'game_session_id,team_id',
    })
    if (error) this.fail('Грешка при запис на тайбрекър отговорите', error)
  }

  // ---- realtime ---------------------------------------------------------
  subscribeToSession(sessionId: string, onChange: () => void): () => void {
    const channel = this.client
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
        onChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_answers',
          filter: `game_session_id=eq.${sessionId}`,
        },
        onChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tiebreaker_answers',
          filter: `game_session_id=eq.${sessionId}`,
        },
        onChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `game_session_id=eq.${sessionId}`,
        },
        onChange,
      )
      .subscribe()

    return () => {
      void this.client.removeChannel(channel)
    }
  }
}
