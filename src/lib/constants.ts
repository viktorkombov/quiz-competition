import type { GameStatus, SessionStatus } from '@/types/models'

export const STATUS_LABELS: Record<GameStatus, string> = {
  draft: 'Чернова',
  published: 'Публикувана',
  archived: 'Архивирана',
}

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  setup: 'Подготовка',
  active: 'Активна',
  tiebreaker: 'Тайбрекър',
  completed: 'Завършена',
  cancelled: 'Отказана',
}

export const MIN_TEAMS = 2
