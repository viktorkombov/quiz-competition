import { describe, it, expect } from 'vitest'
import { tiebreakerDifference, resolveTiebreaker } from '../tiebreaker'
import { makeTeam } from './factories'

describe('tiebreakerDifference', () => {
  it('is the absolute difference regardless of direction', () => {
    expect(tiebreakerDifference(1990, 1994)).toBe(4)
    expect(tiebreakerDifference(2000, 1994)).toBe(6)
    expect(tiebreakerDifference(1994, 1994)).toBe(0)
  })
})

describe('resolveTiebreaker — closest numeric answer wins', () => {
  const teamA = makeTeam('Алфа', { id: 'a' })
  const teamB = makeTeam('Бета', { id: 'b' })

  it('does not compute differences before reveal', () => {
    const result = resolveTiebreaker(
      [teamA, teamB],
      new Map([
        ['a', 1990],
        ['b', 2001],
      ]),
      1994,
      false,
    )
    expect(result.entries.every((e) => e.difference === null)).toBe(true)
    expect(result.winners).toEqual([])
    expect(result.hasAnswers).toBe(true)
  })

  it('selects the team with the smallest difference after reveal', () => {
    const result = resolveTiebreaker(
      [teamA, teamB],
      new Map([
        ['a', 1990], // diff 4
        ['b', 1996], // diff 2  -> winner
      ]),
      1994,
      true,
    )
    expect(result.stillTied).toBe(false)
    expect(result.winners.map((t) => t.id)).toEqual(['b'])
    const bEntry = result.entries.find((e) => e.team.id === 'b')!
    expect(bEntry.difference).toBe(2)
    expect(bEntry.rank).toBe(1)
    expect(bEntry.isWinner).toBe(true)
  })
})

describe('resolveTiebreaker — equal differences remain tied', () => {
  it('reports still-tied when two teams share the smallest difference', () => {
    const teamA = makeTeam('Алфа', { id: 'a' })
    const teamB = makeTeam('Бета', { id: 'b' })
    const result = resolveTiebreaker(
      [teamA, teamB],
      new Map([
        ['a', 1990], // diff 4
        ['b', 1998], // diff 4
      ]),
      1994,
      true,
    )
    expect(result.stillTied).toBe(true)
    expect(result.winners.map((t) => t.id).sort()).toEqual(['a', 'b'])
    // Both share rank 1.
    expect(result.entries.filter((e) => e.rank === 1).length).toBe(2)
  })
})

describe('resolveTiebreaker — missing answers', () => {
  it('ranks answered teams ahead of unanswered ones and never lets a blank win', () => {
    const teamA = makeTeam('Алфа', { id: 'a' })
    const teamB = makeTeam('Бета', { id: 'b' })
    const result = resolveTiebreaker(
      [teamA, teamB],
      new Map([
        ['a', 1990], // diff 4
        ['b', null], // no answer
      ]),
      1994,
      true,
    )
    expect(result.winners.map((t) => t.id)).toEqual(['a'])
    const bEntry = result.entries.find((e) => e.team.id === 'b')!
    expect(bEntry.difference).toBeNull()
    expect(bEntry.rank).toBeNull()
    expect(bEntry.isWinner).toBe(false)
  })

  it('handles all teams missing an answer as no winner', () => {
    const teamA = makeTeam('Алфа', { id: 'a' })
    const teamB = makeTeam('Бета', { id: 'b' })
    const result = resolveTiebreaker(
      [teamA, teamB],
      new Map([
        ['a', null],
        ['b', null],
      ]),
      1994,
      true,
    )
    expect(result.hasAnswers).toBe(false)
    expect(result.winners).toEqual([])
    expect(result.stillTied).toBe(false)
  })
})
