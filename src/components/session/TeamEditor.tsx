import { ChevronDown, ChevronUp, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MIN_TEAMS } from '@/lib/constants'

interface TeamEditorProps {
  names: string[]
  onChange: (names: string[]) => void
}

/** Add / rename / remove / reorder team names. Requires at least MIN_TEAMS. */
export function TeamEditor({ names, onChange }: TeamEditorProps) {
  const update = (index: number, value: string) => {
    const next = [...names]
    next[index] = value
    onChange(next)
  }
  const add = () => onChange([...names, ''])
  const remove = (index: number) => onChange(names.filter((_, i) => i !== index))
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= names.length) return
    const next = [...names]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Users className="h-4 w-4" aria-hidden="true" />
        Отбори ({names.length})
      </div>
      {names.map((name, index) => (
        <div key={index} className="flex items-center gap-2">
          <Label htmlFor={`team-${index}`} className="sr-only">
            Име на отбор {index + 1}
          </Label>
          <span className="w-6 text-sm text-muted-foreground">{index + 1}.</span>
          <Input
            id={`team-${index}`}
            value={name}
            onChange={(e) => update(index, e.target.value)}
            placeholder={`Отбор ${index + 1}`}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => move(index, -1)}
            disabled={index === 0}
            aria-label="Премести нагоре"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => move(index, 1)}
            disabled={index === names.length - 1}
            aria-label="Премести надолу"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => remove(index)}
            disabled={names.length <= MIN_TEAMS}
            aria-label="Премахни отбора"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4" />
        Добави отбор
      </Button>
    </div>
  )
}

/** Validate team names: at least MIN_TEAMS non-empty, unique. */
export function validateTeamNames(names: string[]): string | null {
  const trimmed = names.map((n) => n.trim()).filter((n) => n.length > 0)
  if (trimmed.length < MIN_TEAMS) {
    return `Нужни са поне ${MIN_TEAMS} отбора с имена.`
  }
  const lower = trimmed.map((n) => n.toLowerCase())
  if (new Set(lower).size !== lower.length) {
    return 'Имената на отборите трябва да са уникални.'
  }
  return null
}
