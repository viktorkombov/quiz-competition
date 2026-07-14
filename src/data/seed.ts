import type {
  Game,
  Question,
  QuestionOption,
  Round,
  Tiebreaker,
} from '@/types/models'
import { createId } from '@/lib/utils'
import type { LocalDB } from './local'

export const DEMO_ADMIN = {
  email: 'admin@quiz.local',
  password: 'demo1234',
  displayName: 'Демо администратор',
}

/**
 * Builds the initial localStorage database: one demo admin and one sample quiz
 * ("Обща култура") with two rounds, six questions and a tiebreaker.
 */
export function buildSeedData(): LocalDB {
  const now = new Date().toISOString()
  const ownerId = createId()

  const game: Game = {
    id: createId(),
    owner_id: ownerId,
    title: 'Обща култура',
    description: 'Примерен куиз с два кръга и тайбрекър.',
    status: 'published',
    public_scoreboard_enabled: true,
    created_at: now,
    updated_at: now,
  }

  const round1: Round = {
    id: createId(),
    game_id: game.id,
    title: 'Кръг 1 — Наука',
    order_index: 0,
  }
  const round2: Round = {
    id: createId(),
    game_id: game.id,
    title: 'Кръг 2 — География',
    order_index: 1,
  }

  const questions: Question[] = []
  const options: QuestionOption[] = []

  const addQuestion = (
    roundId: string | null,
    text: string,
    points: number,
    optionTexts: string[],
    correctIndex: number,
  ) => {
    const questionId = createId()
    const optionIds = optionTexts.map(() => createId())
    optionTexts.forEach((optText, i) => {
      options.push({
        id: optionIds[i],
        question_id: questionId,
        text: optText,
        order_index: i,
      })
    })
    questions.push({
      id: questionId,
      game_id: game.id,
      round_id: roundId,
      text,
      points,
      order_index: questions.length,
      correct_option_id: optionIds[correctIndex],
      created_at: now,
      updated_at: now,
    })
  }

  addQuestion(
    round1.id,
    'Кой химичен елемент има символ „O“?',
    1,
    ['Злато', 'Кислород', 'Осмий', 'Олово'],
    1,
  )
  addQuestion(
    round1.id,
    'Колко планети има в Слънчевата система?',
    1,
    ['7', '8', '9', '10'],
    1,
  )
  addQuestion(
    round1.id,
    'Каква е скоростта на светлината във вакуум (приблизително)?',
    2,
    ['300 000 km/s', '150 000 km/s', '1 000 km/s', '3 000 000 km/s'],
    0,
  )
  addQuestion(
    round2.id,
    'Коя е столицата на България?',
    1,
    ['Пловдив', 'Варна', 'София', 'Бургас'],
    2,
  )
  addQuestion(
    round2.id,
    'Коя е най-дългата река в света?',
    2,
    ['Амазонка', 'Нил', 'Яндзъ', 'Мисисипи'],
    1,
  )
  addQuestion(
    round2.id,
    'На кой континент се намира пустинята Сахара?',
    1,
    ['Азия', 'Австралия', 'Африка', 'Южна Америка'],
    2,
  )

  const tiebreaker: Tiebreaker = {
    id: createId(),
    game_id: game.id,
    question_text: 'През коя година е основана София като столица на България?',
    correct_value: 1879,
    unit_label: 'година',
    instructions: 'Въведете точна година. Печели най-близкото предположение.',
  }

  return {
    users: [
      {
        id: ownerId,
        email: DEMO_ADMIN.email,
        password: DEMO_ADMIN.password,
        displayName: DEMO_ADMIN.displayName,
      },
    ],
    currentUserId: null,
    profiles: [{ id: ownerId, display_name: DEMO_ADMIN.displayName, created_at: now }],
    games: [game],
    rounds: [round1, round2],
    questions,
    options,
    tiebreakers: [tiebreaker],
    sessions: [],
    teams: [],
    answers: [],
    tiebreakerAnswers: [],
  }
}
