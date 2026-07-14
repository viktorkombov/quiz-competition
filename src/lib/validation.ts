import { z } from 'zod'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().email('Въведете валиден имейл.'),
  password: z.string().min(6, 'Паролата трябва да е поне 6 символа.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const signUpSchema = loginSchema.extend({
  displayName: z.string().min(2, 'Въведете име (поне 2 символа).'),
})
export type SignUpValues = z.infer<typeof signUpSchema>

// ---------------------------------------------------------------------------
// Game editor
// ---------------------------------------------------------------------------
export const optionSchema = z.object({
  id: z.string(),
  text: z.string(),
})

export const questionSchema = z
  .object({
    id: z.string(),
    roundId: z.string().nullable(),
    text: z.string().trim().min(1, 'Текстът на въпроса е задължителен.'),
    points: z
      .number({ invalid_type_error: 'Точките трябва да са число.' })
      .int('Точките трябва да са цяло число.')
      .positive('Точките трябва да са положително число.'),
    options: z.array(optionSchema),
    correctOptionId: z.string().nullable(),
  })
  .superRefine((q, ctx) => {
    const nonEmpty = q.options.filter((o) => o.text.trim().length > 0)
    if (nonEmpty.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Нужни са поне два непразни отговора.',
        path: ['options'],
      })
    }
    if (!q.correctOptionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Изберете точно един верен отговор.',
        path: ['correctOptionId'],
      })
    } else {
      const correct = q.options.find((o) => o.id === q.correctOptionId)
      if (!correct || correct.text.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Верният отговор трябва да е непразен избран отговор.',
          path: ['correctOptionId'],
        })
      }
    }
  })

export const roundSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, 'Заглавието на кръга е задължително.'),
})

export const editorSchema = z
  .object({
    title: z.string().trim().min(1, 'Заглавието на играта е задължително.'),
    description: z.string(),
    publicScoreboardEnabled: z.boolean(),
    status: z.enum(['draft', 'published', 'archived']),
    rounds: z.array(roundSchema),
    questions: z.array(questionSchema).min(1, 'Добавете поне един въпрос.'),
    tiebreakerEnabled: z.boolean(),
    tiebreaker: z.object({
      questionText: z.string(),
      correctValue: z.union([z.number(), z.nan()]),
      unitLabel: z.string(),
      instructions: z.string(),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.tiebreakerEnabled) {
      if (data.tiebreaker.questionText.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Въведете въпрос за тайбрекъра.',
          path: ['tiebreaker', 'questionText'],
        })
      }
      if (Number.isNaN(data.tiebreaker.correctValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Въведете вярна числова стойност.',
          path: ['tiebreaker', 'correctValue'],
        })
      }
    }
  })

export type EditorValues = z.infer<typeof editorSchema>
export type QuestionValues = z.infer<typeof questionSchema>
export type OptionValues = z.infer<typeof optionSchema>
export type RoundValues = z.infer<typeof roundSchema>
