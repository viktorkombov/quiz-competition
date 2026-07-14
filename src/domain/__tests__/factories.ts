import type { Question, Team, TeamAnswer } from '@/types/models'

let counter = 0
const nextId = (prefix: string) => `${prefix}-${++counter}`

export function makeTeam(name: string, overrides: Partial<Team> = {}): Team {
  return {
    id: overrides.id ?? nextId('team'),
    game_session_id: overrides.game_session_id ?? 'session-1',
    name,
    order_index: overrides.order_index ?? 0,
    ...overrides,
  }
}

export function makeQuestion(overrides: Partial<Question> = {}): Question {
  const id = overrides.id ?? nextId('q')
  return {
    id,
    game_id: overrides.game_id ?? 'game-1',
    round_id: overrides.round_id ?? null,
    text: overrides.text ?? 'Question?',
    points: overrides.points ?? 1,
    order_index: overrides.order_index ?? 0,
    correct_option_id: overrides.correct_option_id ?? `${id}-opt-correct`,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-01-01T00:00:00.000Z',
  }
}

export function makeAnswer(
  teamId: string,
  questionId: string,
  awardedPoints: number,
  overrides: Partial<TeamAnswer> = {},
): TeamAnswer {
  return {
    id: overrides.id ?? nextId('ans'),
    game_session_id: overrides.game_session_id ?? 'session-1',
    question_id: questionId,
    team_id: teamId,
    selected_option_id: overrides.selected_option_id ?? null,
    is_correct: overrides.is_correct ?? awardedPoints > 0,
    awarded_points: awardedPoints,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-01-01T00:00:00.000Z',
  }
}
