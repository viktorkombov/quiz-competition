import type { GameTemplate, QuestionWithOptions } from '@/types/models'

export interface RoundGroup {
  roundId: string | null
  questions: QuestionWithOptions[]
}

/**
 * Group questions by round: each defined round in its order first (only if it
 * has questions), then any questions without a round last.
 */
export function groupByRound(template: GameTemplate): RoundGroup[] {
  const groups: RoundGroup[] = []
  for (const round of template.rounds) {
    const qs = template.questions.filter((q) => q.round_id === round.id)
    if (qs.length > 0) groups.push({ roundId: round.id, questions: qs })
  }
  const noRound = template.questions.filter((q) => q.round_id === null)
  if (noRound.length > 0) groups.push({ roundId: null, questions: noRound })
  return groups
}

/**
 * The definitive play sequence: questions flattened in round order. This is the
 * single source of truth for "question N of M", previous/next navigation and
 * resuming a session after a reload.
 */
export function orderedQuestions(template: GameTemplate): QuestionWithOptions[] {
  return groupByRound(template).flatMap((g) => g.questions)
}

/** Index of a question within the ordered sequence (-1 when not found). */
export function questionIndex(template: GameTemplate, questionId: string | null): number {
  if (!questionId) return -1
  return orderedQuestions(template).findIndex((q) => q.id === questionId)
}
