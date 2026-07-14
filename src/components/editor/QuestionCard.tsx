import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { Copy, GripVertical, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import type { EditorValues } from '@/lib/validation'
import { createId, optionLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface QuestionCardProps {
  form: UseFormReturn<EditorValues>
  index: number
  total: number
  onRemove: () => void
  onDuplicate: () => void
  onMove: (direction: -1 | 1) => void
}

const NO_ROUND = '__none__'

export function QuestionCard({
  form,
  index,
  total,
  onRemove,
  onDuplicate,
  onMove,
}: QuestionCardProps) {
  const { control, register, watch, setValue, formState } = form
  const options = useFieldArray({ control, name: `questions.${index}.options` })
  const rounds = watch('rounds')
  const correctOptionId = watch(`questions.${index}.correctOptionId`)
  const questionErrors = formState.errors.questions?.[index]

  const addOption = () => {
    options.append({ id: createId(), text: '' })
  }

  const removeOption = (optIndex: number, optionId: string) => {
    if (correctOptionId === optionId) {
      setValue(`questions.${index}.correctOptionId`, null, { shouldDirty: true })
    }
    options.remove(optIndex)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <GripVertical className="h-4 w-4" aria-hidden="true" />
          Въпрос {index + 1}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Премести нагоре"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Премести надолу"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onDuplicate}
            aria-label="Дублирай въпроса"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label="Изтрий въпроса"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`q-${index}-text`}>Текст на въпроса</Label>
          <Input id={`q-${index}-text`} {...register(`questions.${index}.text`)} />
          {questionErrors?.text && (
            <p className="text-sm text-destructive">{questionErrors.text.message}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`q-${index}-points`}>Точки</Label>
            <Input
              id={`q-${index}-points`}
              type="number"
              min={1}
              step={1}
              {...register(`questions.${index}.points`, { valueAsNumber: true })}
            />
            {questionErrors?.points && (
              <p className="text-sm text-destructive">{questionErrors.points.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Кръг</Label>
            <Select
              value={watch(`questions.${index}.roundId`) ?? NO_ROUND}
              onValueChange={(v) =>
                setValue(`questions.${index}.roundId`, v === NO_ROUND ? null : v, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Без кръг" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ROUND}>Без кръг</SelectItem>
                {rounds.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title || 'Кръг без име'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Отговори (изберете верния)</legend>
          {options.fields.map((field, optIndex) => {
            const optionId = watch(`questions.${index}.options.${optIndex}.id`)
            const isCorrect = correctOptionId === optionId
            return (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${index}`}
                  id={`q-${index}-correct-${optIndex}`}
                  checked={isCorrect}
                  onChange={() =>
                    setValue(`questions.${index}.correctOptionId`, optionId, {
                      shouldDirty: true,
                    })
                  }
                  className="h-4 w-4 accent-[hsl(var(--success))]"
                  aria-label={`Маркирай отговор ${optionLabel(optIndex)} като верен`}
                />
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold"
                >
                  {optionLabel(optIndex)}
                </span>
                <Input
                  {...register(`questions.${index}.options.${optIndex}.text`)}
                  placeholder={`Отговор ${optionLabel(optIndex)}`}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeOption(optIndex, optionId)}
                  disabled={options.fields.length <= 2}
                  aria-label={`Премахни отговор ${optionLabel(optIndex)}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
          {questionErrors?.options && (
            <p className="text-sm text-destructive">
              {questionErrors.options.message ?? 'Проверете отговорите.'}
            </p>
          )}
          {questionErrors?.correctOptionId && (
            <p className="text-sm text-destructive">{questionErrors.correctOptionId.message}</p>
          )}
          <Button type="button" size="sm" variant="outline" onClick={addOption}>
            <Plus className="h-4 w-4" />
            Добави отговор
          </Button>
        </fieldset>
      </CardContent>
    </Card>
  )
}
