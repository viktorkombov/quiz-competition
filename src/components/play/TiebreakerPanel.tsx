import * as React from 'react'
import { Eye } from 'lucide-react'
import type { Team, Tiebreaker } from '@/types/models'
import { resolveTiebreaker, type TiebreakerResult } from '@/domain/tiebreaker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface TiebreakerPanelProps {
  tiebreaker: Tiebreaker
  tiedTeams: Team[]
  /** Existing values keyed by team id (persisted answers). */
  initialValues: Map<string, number | null>
  revealed: boolean
  saving: boolean
  onReveal: (values: Map<string, number | null>) => void
  onDeclareJointWinners: () => void
  onAddAdHocRound: () => void
}

/** Tiebreaker mode: numeric closest-answer among the tied-for-first teams. */
export function TiebreakerPanel({
  tiebreaker,
  tiedTeams,
  initialValues,
  revealed,
  saving,
  onReveal,
  onDeclareJointWinners,
  onAddAdHocRound,
}: TiebreakerPanelProps) {
  const [inputs, setInputs] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const team of tiedTeams) {
      const v = initialValues.get(team.id)
      initial[team.id] = v == null ? '' : String(v)
    }
    return initial
  })

  const parsedValues = React.useMemo(() => {
    const map = new Map<string, number | null>()
    for (const team of tiedTeams) {
      const raw = inputs[team.id]?.trim()
      const num = raw && raw.length > 0 ? Number(raw) : null
      map.set(team.id, num != null && !Number.isNaN(num) ? num : null)
    }
    return map
  }, [inputs, tiedTeams])

  const result: TiebreakerResult = resolveTiebreaker(
    tiedTeams,
    parsedValues,
    tiebreaker.correct_value,
    revealed,
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Тайбрекър</Badge>
          <CardTitle>Изравняване за първо място</CardTitle>
        </div>
        <CardDescription>
          Участват само отборите, делящи първо място. Печели най-близкото число.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg bg-muted p-4">
          <p className="text-lg font-semibold">{tiebreaker.question_text}</p>
          {tiebreaker.instructions && (
            <p className="mt-1 text-sm text-muted-foreground">{tiebreaker.instructions}</p>
          )}
          {revealed && (
            <p className="mt-2 text-sm font-medium">
              Вярна стойност: {tiebreaker.correct_value}
              {tiebreaker.unit_label ? ` ${tiebreaker.unit_label}` : ''}
            </p>
          )}
        </div>

        <div className="space-y-3">
          {tiedTeams.map((team) => {
            const entry = result.entries.find((e) => e.team.id === team.id)
            return (
              <div
                key={team.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-lg border p-3',
                  revealed && entry?.isWinner && 'border-success bg-success/10',
                )}
              >
                <Label htmlFor={`tb-${team.id}`} className="min-w-[8rem] font-semibold">
                  {team.name}
                </Label>
                <Input
                  id={`tb-${team.id}`}
                  type="number"
                  step="any"
                  inputMode="numeric"
                  className="max-w-[10rem]"
                  value={inputs[team.id] ?? ''}
                  disabled={revealed}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [team.id]: e.target.value }))
                  }
                  placeholder={tiebreaker.unit_label ?? 'число'}
                />
                {revealed && entry && (
                  <span className="text-sm text-muted-foreground">
                    Разлика:{' '}
                    <strong>{entry.difference == null ? '—' : entry.difference}</strong>
                    {entry.isWinner && (
                      <Badge variant="success" className="ml-2">
                        Печели
                      </Badge>
                    )}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {!revealed ? (
          <Button size="lg" disabled={saving} onClick={() => onReveal(parsedValues)}>
            <Eye className="h-5 w-5" />
            Разкрий вярната стойност
          </Button>
        ) : result.stillTied ? (
          <div className="space-y-3 rounded-lg border border-accent/50 bg-accent/10 p-4">
            <p className="text-sm font-medium">
              Тайбрекърът е все още равен ({result.winners.map((t) => t.name).join(', ')}).
              Изберете как да продължите:
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onAddAdHocRound} disabled={saving}>
                Нов допълнителен тайбрекър
              </Button>
              <Button onClick={onDeclareJointWinners} disabled={saving}>
                Обяви споделена победа
              </Button>
            </div>
          </div>
        ) : (
          <Button size="lg" onClick={onDeclareJointWinners} disabled={saving}>
            Завърши с победител
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
