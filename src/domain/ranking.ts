import type { Team, TeamAnswer } from '@/types/models'
import { computeTeamTotals, pointsForQuestion } from './scoring'

export interface RankedTeam {
  team: Team
  totalPoints: number
  /** Points earned on the most recently revealed question (0 if none). */
  lastQuestionPoints: number
  /**
   * Competition rank. Tied teams share the same rank and the next rank skips
   * accordingly (e.g. two teams at rank 1 are followed by rank 3).
   */
  rank: number
  /** True when this team shares the best (rank 1) score. */
  isLeader: boolean
}

/**
 * Rank teams by total points.
 *
 * Sorting rules:
 *   1. total points, descending  — the only competition-relevant criterion;
 *   2. team name, ascending      — a purely cosmetic, stable tiebreak so the
 *      visual order does not jump around. It NEVER decides the competition:
 *      teams with equal points always share the same `rank`.
 */
export function rankTeams(
  teams: Team[],
  answers: TeamAnswer[],
  lastQuestionId: string | null = null,
): RankedTeam[] {
  const totals = computeTeamTotals(answers)
  const lastPoints = pointsForQuestion(answers, lastQuestionId)

  const rows = teams.map((team) => ({
    team,
    totalPoints: totals.get(team.id) ?? 0,
    lastQuestionPoints: lastPoints.get(team.id) ?? 0,
  }))

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    // Cosmetic only — see doc comment.
    return a.team.name.localeCompare(b.team.name, 'bg')
  })

  const ranked: RankedTeam[] = []
  let previousPoints: number | null = null
  let currentRank = 0
  rows.forEach((row, index) => {
    if (previousPoints === null || row.totalPoints !== previousPoints) {
      // Standard competition ranking: rank equals 1-based position of the
      // first team in this points group.
      currentRank = index + 1
      previousPoints = row.totalPoints
    }
    ranked.push({
      ...row,
      rank: currentRank,
      isLeader: false,
    })
  })

  // Mark leaders: everyone sharing rank 1, but only if they have a positive
  // score OR at least one point has been awarded anywhere (avoids declaring a
  // "leader" before the game has produced any points).
  const anyPoints = ranked.some((r) => r.totalPoints > 0)
  for (const row of ranked) {
    row.isLeader = anyPoints && row.rank === 1
  }

  return ranked
}

/** Teams sharing the top score. Empty when there are no teams. */
export function getLeaders(ranked: RankedTeam[]): RankedTeam[] {
  if (ranked.length === 0) return []
  const top = ranked[0].totalPoints
  return ranked.filter((r) => r.totalPoints === top)
}

export interface FirstPlaceResult {
  topScore: number
  leaders: RankedTeam[]
  /** True when two or more teams share the top score. */
  isTie: boolean
  /** True when exactly one team holds the top score. */
  hasSingleWinner: boolean
}

/**
 * Analyse first place after the normal questions to decide game completion.
 */
export function analyseFirstPlace(ranked: RankedTeam[]): FirstPlaceResult {
  const leaders = getLeaders(ranked)
  const topScore = leaders[0]?.totalPoints ?? 0
  return {
    topScore,
    leaders,
    isTie: leaders.length > 1,
    hasSingleWinner: leaders.length === 1,
  }
}
