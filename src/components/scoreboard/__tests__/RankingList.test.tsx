import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RankingList } from '../RankingList'
import type { RankedTeam } from '@/domain/ranking'

function ranked(): RankedTeam[] {
  return [
    {
      team: { id: 'a', game_session_id: 's', name: 'Алфа', order_index: 0 },
      totalPoints: 5,
      lastQuestionPoints: 2,
      rank: 1,
      isLeader: true,
    },
    {
      team: { id: 'b', game_session_id: 's', name: 'Бета', order_index: 1 },
      totalPoints: 3,
      lastQuestionPoints: 0,
      rank: 2,
      isLeader: false,
    },
  ]
}

describe('RankingList', () => {
  it('renders team names, points and marks the leader', () => {
    render(<RankingList ranked={ranked()} />)
    expect(screen.getByText('Алфа')).toBeInTheDocument()
    expect(screen.getByText('Бета')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    // Leader badge text is present for the top team only.
    expect(screen.getAllByText('Водач')).toHaveLength(1)
  })

  it('shows last-question points when requested', () => {
    render(<RankingList ranked={ranked()} showLastPoints />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})
