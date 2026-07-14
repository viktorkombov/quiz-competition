import { CheckCircle2, XCircle } from 'lucide-react'
import type { QuestionWithOptions, Team } from '@/types/models'
import { cn, optionLabel } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const NO_ANSWER = '__none__'

interface TeamPanelProps {
  teams: Team[]
  question: QuestionWithOptions
  selections: Map<string, string | null>
  revealed: boolean
  locked: boolean
  onSelect: (teamId: string, optionId: string | null) => void
}

/** Right column: one answer selector per team, plus result status on reveal. */
export function TeamPanel({
  teams,
  question,
  selections,
  revealed,
  locked,
  onSelect,
}: TeamPanelProps) {
  return (
    <div className="space-y-3">
      {teams.map((team) => {
        const selected = selections.get(team.id) ?? null
        const isCorrect = revealed && selected === question.correct_option_id
        const answered = selected != null
        return (
          <div
            key={team.id}
            className={cn(
              'rounded-lg border p-3',
              revealed && isCorrect && 'border-success bg-success/5',
              revealed && !isCorrect && 'border-destructive/40 bg-destructive/5',
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label htmlFor={`team-answer-${team.id}`} className="font-semibold">
                {team.name}
              </Label>
              {revealed &&
                (isCorrect ? (
                  <span className="flex items-center gap-1 text-sm font-semibold text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />+{question.points}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm font-semibold text-destructive">
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    {answered ? '0' : 'без отговор'}
                  </span>
                ))}
            </div>
            <Select
              value={selected ?? NO_ANSWER}
              disabled={locked}
              onValueChange={(v) => onSelect(team.id, v === NO_ANSWER ? null : v)}
            >
              <SelectTrigger id={`team-answer-${team.id}`}>
                <SelectValue placeholder="Изберете отговор" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ANSWER}>Без отговор</SelectItem>
                {question.options.map((opt, index) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {optionLabel(index)}. {opt.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      })}
    </div>
  )
}
