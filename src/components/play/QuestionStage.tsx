import { CheckCircle2 } from 'lucide-react'
import type { QuestionWithOptions } from '@/types/models'
import { cn, optionLabel } from '@/lib/utils'

interface QuestionStageProps {
  question: QuestionWithOptions
  revealed: boolean
  /** Option ids that at least one team selected (for red highlight on reveal). */
  selectedWrongOptionIds: Set<string>
}

/** Left column of the host screen: the question and its large answer cards. */
export function QuestionStage({
  question,
  revealed,
  selectedWrongOptionIds,
}: QuestionStageProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-balance text-2xl font-bold leading-tight md:text-3xl lg:text-4xl">
        {question.text}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {question.options.map((opt, index) => {
          const isCorrect = revealed && opt.id === question.correct_option_id
          const isWrongSelected =
            revealed && selectedWrongOptionIds.has(opt.id) && opt.id !== question.correct_option_id
          return (
            <li
              key={opt.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border-2 p-4 text-lg transition-colors md:text-xl',
                isCorrect && 'border-success bg-success/10',
                isWrongSelected && 'border-destructive bg-destructive/10',
                !isCorrect && !isWrongSelected && 'border-border',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold',
                  isCorrect
                    ? 'bg-success text-success-foreground'
                    : isWrongSelected
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-muted',
                )}
              >
                {optionLabel(index)}
              </span>
              <span className="flex-1 font-medium">{opt.text}</span>
              {isCorrect && (
                <span className="flex items-center gap-1 text-sm font-semibold text-success">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  Верен
                </span>
              )}
              {isWrongSelected && (
                <span className="text-sm font-semibold text-destructive">Грешен</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
