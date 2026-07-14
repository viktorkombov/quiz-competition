import { describe, it, expect } from 'vitest'
import { rankTeams, getLeaders, analyseFirstPlace } from '../ranking'
import { makeTeam, makeAnswer } from './factories'

describe('rankTeams — one clear winner', () => {
  it('orders teams by total points descending', () => {
    const teamA = makeTeam('Алфа', { id: 'a' })
    const teamB = makeTeam('Бета', { id: 'b' })
    const teamC = makeTeam('Гама', { id: 'c' })
    const answers = [
      makeAnswer('a', 'q1', 3),
      makeAnswer('b', 'q1', 1),
      makeAnswer('c', 'q1', 0),
    ]
    const ranked = rankTeams([teamA, teamB, teamC], answers)
    expect(ranked.map((r) => r.team.id)).toEqual(['a', 'b', 'c'])
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3])
    expect(ranked[0].isLeader).toBe(true)
    expect(ranked[1].isLeader).toBe(false)
  })
})

describe('rankTeams — tied ranks', () => {
  it('assigns the same rank to teams with equal points and skips the next', () => {
    const teamA = makeTeam('Алфа', { id: 'a' })
    const teamB = makeTeam('Бета', { id: 'b' })
    const teamC = makeTeam('Гама', { id: 'c' })
    const answers = [
      makeAnswer('a', 'q1', 2),
      makeAnswer('b', 'q1', 2),
      makeAnswer('c', 'q1', 0),
    ]
    const ranked = rankTeams([teamA, teamB, teamC], answers)
    // Two teams tied at rank 1, next team is rank 3 (competition ranking).
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3])
  })

  it('uses team name only for stable visual order among equal scores', () => {
    const teamZ = makeTeam('Я', { id: 'z' })
    const teamA = makeTeam('А', { id: 'a' })
    const answers = [makeAnswer('z', 'q1', 1), makeAnswer('a', 'q1', 1)]
    const ranked = rankTeams([teamZ, teamA], answers)
    // "А" sorts before "Я" cosmetically, but both share rank 1.
    expect(ranked.map((r) => r.team.id)).toEqual(['a', 'z'])
    expect(ranked.map((r) => r.rank)).toEqual([1, 1])
  })
})

describe('rankTeams — missing answers count as zero', () => {
  it('places teams without answers last with a zero total', () => {
    const teamA = makeTeam('Алфа', { id: 'a' })
    const teamB = makeTeam('Бета', { id: 'b' })
    const answers = [makeAnswer('a', 'q1', 1)]
    const ranked = rankTeams([teamA, teamB], answers)
    expect(ranked[0].team.id).toBe('a')
    expect(ranked[1].totalPoints).toBe(0)
    expect(ranked[1].rank).toBe(2)
  })
})

describe('rankTeams — last question points', () => {
  it('reports the points earned on the most recent question', () => {
    const teamA = makeTeam('Алфа', { id: 'a' })
    const answers = [makeAnswer('a', 'q1', 1), makeAnswer('a', 'q2', 3)]
    const ranked = rankTeams([teamA], answers, 'q2')
    expect(ranked[0].totalPoints).toBe(4)
    expect(ranked[0].lastQuestionPoints).toBe(3)
  })
})

describe('getLeaders / analyseFirstPlace', () => {
  it('detects a single winner', () => {
    const teamA = makeTeam('Алфа', { id: 'a' })
    const teamB = makeTeam('Бета', { id: 'b' })
    const answers = [makeAnswer('a', 'q1', 3), makeAnswer('b', 'q1', 1)]
    const ranked = rankTeams([teamA, teamB], answers)
    const result = analyseFirstPlace(ranked)
    expect(result.hasSingleWinner).toBe(true)
    expect(result.isTie).toBe(false)
    expect(result.leaders.map((l) => l.team.id)).toEqual(['a'])
    expect(result.topScore).toBe(3)
  })

  it('detects multiple teams tied for first place', () => {
    const teamA = makeTeam('Алфа', { id: 'a' })
    const teamB = makeTeam('Бета', { id: 'b' })
    const teamC = makeTeam('Гама', { id: 'c' })
    const answers = [
      makeAnswer('a', 'q1', 3),
      makeAnswer('b', 'q1', 3),
      makeAnswer('c', 'q1', 1),
    ]
    const ranked = rankTeams([teamA, teamB, teamC], answers)
    const result = analyseFirstPlace(ranked)
    expect(result.isTie).toBe(true)
    expect(result.hasSingleWinner).toBe(false)
    expect(getLeaders(ranked).map((l) => l.team.id).sort()).toEqual(['a', 'b'])
    expect(result.topScore).toBe(3)
  })

  it('treats an all-zero board as a full tie with no declared leader flag', () => {
    const teamA = makeTeam('Алфа', { id: 'a' })
    const teamB = makeTeam('Бета', { id: 'b' })
    const ranked = rankTeams([teamA, teamB], [])
    // No points awarded yet -> nobody is highlighted as leader.
    expect(ranked.every((r) => r.isLeader === false)).toBe(true)
    // But the first-place analysis still reports the tie at score 0.
    const result = analyseFirstPlace(ranked)
    expect(result.isTie).toBe(true)
    expect(result.topScore).toBe(0)
  })
})
