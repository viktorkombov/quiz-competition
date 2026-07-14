import type { Team } from '@/types/models'

/** Absolute difference between a team's guess and the correct value. */
export function tiebreakerDifference(answerValue: number, correctValue: number): number {
  return Math.abs(answerValue - correctValue)
}

export interface TiebreakerEntry {
  team: Team
  answerValue: number | null
  /** Absolute difference; null when the team has not answered yet. */
  difference: number | null
  /** Position after resolution (1 = closest). Null until revealed. */
  rank: number | null
  isWinner: boolean
}

export interface TiebreakerResult {
  entries: TiebreakerEntry[]
  winners: Team[]
  /** True when two or more teams share the smallest difference. */
  stillTied: boolean
  /** True when at least one participating team has an answer. */
  hasAnswers: boolean
}

/**
 * Resolve a numeric closest-answer tiebreaker among the tied teams.
 *
 * - The smallest absolute difference wins.
 * - Teams without an answer are ranked last and can never win.
 * - When several teams share the smallest difference the tiebreaker is still
 *   tied (`stillTied = true`) and `winners` contains all of them — the caller
 *   then offers an additional ad-hoc round or joint winners.
 */
export function resolveTiebreaker(
  teams: Team[],
  answersByTeam: Map<string, number | null>,
  correctValue: number,
  revealed: boolean,
): TiebreakerResult {
  const entries: TiebreakerEntry[] = teams.map((team) => {
    const value = answersByTeam.get(team.id)
    const answerValue = value == null || Number.isNaN(value) ? null : value
    const difference =
      revealed && answerValue != null ? tiebreakerDifference(answerValue, correctValue) : null
    return {
      team,
      answerValue,
      difference,
      rank: null,
      isWinner: false,
    }
  })

  const hasAnswers = entries.some((e) => e.answerValue != null)

  if (!revealed) {
    return { entries, winners: [], stillTied: false, hasAnswers }
  }

  // Sort: answered teams by ascending difference first, unanswered last.
  // Team name is a cosmetic-only stable tiebreak, never a competition rule.
  const sorted = [...entries].sort((a, b) => {
    const da = a.difference
    const db = b.difference
    if (da == null && db == null) return a.team.name.localeCompare(b.team.name, 'bg')
    if (da == null) return 1
    if (db == null) return -1
    if (da !== db) return da - db
    return a.team.name.localeCompare(b.team.name, 'bg')
  })

  // Assign competition ranks (ties share a rank) based on difference.
  let previousDiff: number | null | undefined = undefined
  let currentRank = 0
  sorted.forEach((entry, index) => {
    const key = entry.difference
    if (previousDiff === undefined || key !== previousDiff) {
      currentRank = index + 1
      previousDiff = key
    }
    entry.rank = entry.difference == null ? null : currentRank
  })

  const answered = sorted.filter((e) => e.difference != null)
  const bestDiff = answered.length > 0 ? answered[0].difference : null
  const winnerEntries = answered.filter((e) => e.difference === bestDiff)
  for (const entry of winnerEntries) entry.isWinner = true

  return {
    entries: sorted,
    winners: winnerEntries.map((e) => e.team),
    stillTied: winnerEntries.length > 1,
    hasAnswers,
  }
}
