import type { Question, TeamAnswer } from '@/types/models'

export interface ScoreOutcome {
  isCorrect: boolean
  awardedPoints: number
}

/**
 * Pure scoring for a single team answer on a single question.
 *
 * - A team gets the question's configured `points` when its selected option is
 *   the question's `correct_option_id`.
 * - An incorrect selection OR a missing answer (`null`) yields zero points.
 * - `points` is clamped to a non-negative integer so malformed data can never
 *   award negative or fractional points.
 */
export function scoreAnswer(
  question: Pick<Question, 'points' | 'correct_option_id'>,
  selectedOptionId: string | null,
): ScoreOutcome {
  const points = normalizePoints(question.points)
  const isCorrect =
    selectedOptionId != null &&
    question.correct_option_id != null &&
    selectedOptionId === question.correct_option_id
  return {
    isCorrect,
    awardedPoints: isCorrect ? points : 0,
  }
}

/** Ensure points are a non-negative integer (defaults to 1 when invalid). */
export function normalizePoints(points: number): number {
  if (!Number.isFinite(points)) return 1
  const rounded = Math.floor(points)
  return rounded < 0 ? 0 : rounded
}

/**
 * Total points for each team across the provided answers.
 * Uses each answer's persisted `awarded_points` — the authoritative value that
 * was calculated and stored at reveal time — so reloading the page never
 * recalculates (and therefore never double-counts) a score.
 */
export function computeTeamTotals(answers: TeamAnswer[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const answer of answers) {
    const prev = totals.get(answer.team_id) ?? 0
    totals.set(answer.team_id, prev + normalizePoints(answer.awarded_points))
  }
  return totals
}

/** Points each team earned on a specific question (0 when none recorded). */
export function pointsForQuestion(
  answers: TeamAnswer[],
  questionId: string | null,
): Map<string, number> {
  const map = new Map<string, number>()
  if (!questionId) return map
  for (const answer of answers) {
    if (answer.question_id === questionId) {
      map.set(answer.team_id, normalizePoints(answer.awarded_points))
    }
  }
  return map
}

/**
 * Whether every team already has a stored answer for the given question.
 * Used to gate the "Reveal answer" action.
 */
export function allTeamsAnswered(
  answers: TeamAnswer[],
  questionId: string,
  teamIds: string[],
): boolean {
  if (teamIds.length === 0) return false
  const answered = new Set(
    answers.filter((a) => a.question_id === questionId).map((a) => a.team_id),
  )
  return teamIds.every((id) => answered.has(id))
}
