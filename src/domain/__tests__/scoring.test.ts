import { describe, it, expect } from 'vitest'
import {
  scoreAnswer,
  normalizePoints,
  computeTeamTotals,
  pointsForQuestion,
  allTeamsAnswered,
} from '../scoring'
import { makeQuestion, makeAnswer } from './factories'

describe('scoreAnswer — normal scoring', () => {
  it('awards the configured points for a correct answer', () => {
    const q = makeQuestion({ points: 1, correct_option_id: 'opt-A' })
    const outcome = scoreAnswer(q, 'opt-A')
    expect(outcome).toEqual({ isCorrect: true, awardedPoints: 1 })
  })

  it('awards zero for an incorrect answer', () => {
    const q = makeQuestion({ points: 1, correct_option_id: 'opt-A' })
    const outcome = scoreAnswer(q, 'opt-B')
    expect(outcome).toEqual({ isCorrect: false, awardedPoints: 0 })
  })

  it('awards zero for a missing (null) answer', () => {
    const q = makeQuestion({ points: 5, correct_option_id: 'opt-A' })
    const outcome = scoreAnswer(q, null)
    expect(outcome).toEqual({ isCorrect: false, awardedPoints: 0 })
  })
})

describe('scoreAnswer — custom question points', () => {
  it('awards the custom point value on a correct answer', () => {
    const q = makeQuestion({ points: 3, correct_option_id: 'opt-A' })
    expect(scoreAnswer(q, 'opt-A').awardedPoints).toBe(3)
  })

  it('never awards custom points on an incorrect answer', () => {
    const q = makeQuestion({ points: 10, correct_option_id: 'opt-A' })
    expect(scoreAnswer(q, 'opt-Z').awardedPoints).toBe(0)
  })
})

describe('normalizePoints', () => {
  it('floors fractional values', () => {
    expect(normalizePoints(2.9)).toBe(2)
  })
  it('clamps negatives to zero', () => {
    expect(normalizePoints(-4)).toBe(0)
  })
  it('defaults non-finite values to 1', () => {
    expect(normalizePoints(Number.NaN)).toBe(1)
    expect(normalizePoints(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe('computeTeamTotals — uses stored awarded_points (no double counting)', () => {
  it('sums the persisted awarded points per team', () => {
    const answers = [
      makeAnswer('team-a', 'q1', 1),
      makeAnswer('team-a', 'q2', 3),
      makeAnswer('team-b', 'q1', 0),
      makeAnswer('team-b', 'q2', 3),
    ]
    const totals = computeTeamTotals(answers)
    expect(totals.get('team-a')).toBe(4)
    expect(totals.get('team-b')).toBe(3)
  })

  it('reflects a corrected answer once it replaces the old row (no duplicate)', () => {
    // Scoring is derived only from the current set of answer rows. A correction
    // replaces the row rather than adding a second one, so the total reflects
    // exactly one contribution per (team, question).
    const original = [makeAnswer('team-a', 'q1', 1)]
    expect(computeTeamTotals(original).get('team-a')).toBe(1)

    const corrected = [makeAnswer('team-a', 'q1', 3, { id: original[0].id })]
    expect(computeTeamTotals(corrected).get('team-a')).toBe(3)
  })
})

describe('pointsForQuestion', () => {
  it('returns per-team points for the given question only', () => {
    const answers = [
      makeAnswer('team-a', 'q1', 2),
      makeAnswer('team-a', 'q2', 1),
      makeAnswer('team-b', 'q1', 0),
    ]
    const map = pointsForQuestion(answers, 'q1')
    expect(map.get('team-a')).toBe(2)
    expect(map.get('team-b')).toBe(0)
    expect(map.has('__none__')).toBe(false)
  })

  it('returns an empty map when questionId is null', () => {
    expect(pointsForQuestion([makeAnswer('team-a', 'q1', 2)], null).size).toBe(0)
  })
})

describe('allTeamsAnswered — reveal gating', () => {
  const teamIds = ['team-a', 'team-b']

  it('is false while a team is missing an answer', () => {
    const answers = [makeAnswer('team-a', 'q1', 0)]
    expect(allTeamsAnswered(answers, 'q1', teamIds)).toBe(false)
  })

  it('is true once every team has an answer', () => {
    const answers = [makeAnswer('team-a', 'q1', 1), makeAnswer('team-b', 'q1', 0)]
    expect(allTeamsAnswered(answers, 'q1', teamIds)).toBe(true)
  })

  it('is false when there are no teams', () => {
    expect(allTeamsAnswered([], 'q1', [])).toBe(false)
  })
})
