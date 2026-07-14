import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Pencil, Play } from 'lucide-react'
import { repository } from '@/data'
import type { GameTemplate } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState, ErrorState } from '@/components/states'
import { optionLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { groupByRound } from '@/domain/gameFlow'

export function GamePreviewPage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const [template, setTemplate] = React.useState<GameTemplate | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!gameId) return
    setLoading(true)
    try {
      const result = await repository.getTemplate(gameId)
      if (!result) setError('Играта не е намерена.')
      else setTemplate(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при зареждане.')
    } finally {
      setLoading(false)
    }
  }, [gameId])

  React.useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState />
  if (error || !template) return <ErrorState message={error ?? 'Няма данни.'} onRetry={load} />

  const roundsById = new Map(template.rounds.map((r) => [r.id, r]))
  const grouped = groupByRound(template)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} aria-label="Назад">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{template.game.title}</h1>
            {template.game.description && (
              <p className="text-sm text-muted-foreground">{template.game.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={`/games/${template.game.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Редакция
            </Link>
          </Button>
          <Button asChild>
            <Link to={`/games/${template.game.id}/start`}>
              <Play className="h-4 w-4" />
              Старт
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">{template.questions.length} въпроса</Badge>
        <Badge variant="outline">{template.rounds.length} кръга</Badge>
        {template.tiebreaker && <Badge variant="outline">Тайбрекър</Badge>}
      </div>

      <div className="space-y-6">
        {grouped.map((group) => (
          <section key={group.roundId ?? 'none'} className="space-y-3">
            <h2 className="text-lg font-semibold">
              {group.roundId ? (roundsById.get(group.roundId)?.title ?? 'Кръг') : 'Без кръг'}
            </h2>
            <div className="space-y-3">
              {group.questions.map((q, qi) => (
                <Card key={q.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">
                        {qi + 1}. {q.text}
                      </CardTitle>
                      <Badge variant="secondary">
                        {q.points} {q.points === 1 ? 'точка' : 'точки'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt, oi) => {
                        const isCorrect = opt.id === q.correct_option_id
                        return (
                          <li
                            key={opt.id}
                            className={cn(
                              'flex items-center gap-2 rounded-md border p-2 text-sm',
                              isCorrect && 'border-success bg-success/10',
                            )}
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold">
                              {optionLabel(oi)}
                            </span>
                            <span className="flex-1">{opt.text}</span>
                            {isCorrect && (
                              <CheckCircle2 className="h-4 w-4 text-success" aria-label="Верен отговор" />
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      {template.tiebreaker && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Тайбрекър</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{template.tiebreaker.question_text}</p>
            <p className="text-muted-foreground">
              Вярна стойност: {template.tiebreaker.correct_value}
              {template.tiebreaker.unit_label ? ` ${template.tiebreaker.unit_label}` : ''}
            </p>
            {template.tiebreaker.instructions && (
              <p className="text-muted-foreground">{template.tiebreaker.instructions}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

