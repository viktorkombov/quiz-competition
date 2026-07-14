import type {
  Game,
  GameTemplate,
  QuestionWithOptions,
  Round,
  Tiebreaker,
} from '@/types/models'
import type { TemplateDraft } from '@/data/types'
import type { EditorValues } from './validation'
import { createId } from './utils'

export const DEFAULT_OPTION_COUNT = 4

/** Build an empty question with the default number of options. */
export function makeEmptyQuestion(roundId: string | null): EditorValues['questions'][number] {
  const options = Array.from({ length: DEFAULT_OPTION_COUNT }, () => ({
    id: createId(),
    text: '',
  }))
  return {
    id: createId(),
    roundId,
    text: '',
    points: 1,
    options,
    correctOptionId: null,
  }
}

/** Convert a loaded template (or nothing) into editor form values. */
export function templateToEditorValues(template: GameTemplate | null): EditorValues {
  if (!template) {
    return {
      title: '',
      description: '',
      publicScoreboardEnabled: false,
      status: 'draft',
      rounds: [],
      questions: [makeEmptyQuestion(null)],
      tiebreakerEnabled: false,
      tiebreaker: { questionText: '', correctValue: Number.NaN, unitLabel: 'година', instructions: '' },
    }
  }

  return {
    title: template.game.title,
    description: template.game.description ?? '',
    publicScoreboardEnabled: template.game.public_scoreboard_enabled,
    status: template.game.status,
    rounds: template.rounds.map((r) => ({ id: r.id, title: r.title })),
    questions: template.questions.map((q) => ({
      id: q.id,
      roundId: q.round_id,
      text: q.text,
      points: q.points,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      correctOptionId: q.correct_option_id,
    })),
    tiebreakerEnabled: template.tiebreaker != null,
    tiebreaker: {
      questionText: template.tiebreaker?.question_text ?? '',
      correctValue: template.tiebreaker?.correct_value ?? Number.NaN,
      unitLabel: template.tiebreaker?.unit_label ?? 'година',
      instructions: template.tiebreaker?.instructions ?? '',
    },
  }
}

/** Convert editor form values back into a persistable template draft. */
export function editorValuesToDraft(values: EditorValues, game: Game): TemplateDraft {
  const updatedGame: Game = {
    ...game,
    title: values.title.trim(),
    description: values.description.trim() || null,
    status: values.status,
    public_scoreboard_enabled: values.publicScoreboardEnabled,
  }

  const rounds: Round[] = values.rounds.map((r, index) => ({
    id: r.id,
    game_id: game.id,
    title: r.title.trim(),
    order_index: index,
  }))

  const roundIds = new Set(rounds.map((r) => r.id))

  const questions: QuestionWithOptions[] = values.questions.map((q, index) => {
    // Drop empty trailing options so the stored question only keeps real ones.
    const options = q.options
      .filter((o) => o.text.trim().length > 0)
      .map((o, optIndex) => ({
        id: o.id,
        question_id: q.id,
        text: o.text.trim(),
        order_index: optIndex,
      }))
    const correctStillExists =
      q.correctOptionId != null && options.some((o) => o.id === q.correctOptionId)
    return {
      id: q.id,
      game_id: game.id,
      round_id: q.roundId && roundIds.has(q.roundId) ? q.roundId : null,
      text: q.text.trim(),
      points: q.points,
      order_index: index,
      correct_option_id: correctStillExists ? q.correctOptionId : null,
      created_at: game.created_at,
      updated_at: new Date().toISOString(),
      options,
    }
  })

  const tiebreaker: Tiebreaker | null = values.tiebreakerEnabled
    ? {
        id: createId(),
        game_id: game.id,
        question_text: values.tiebreaker.questionText.trim(),
        correct_value: values.tiebreaker.correctValue,
        unit_label: values.tiebreaker.unitLabel.trim() || null,
        instructions: values.tiebreaker.instructions.trim() || null,
      }
    : null

  return { game: updatedGame, rounds, questions, tiebreaker }
}
