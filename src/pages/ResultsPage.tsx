import { useNavigate, useParams } from 'react-router-dom'
import { ExternalLink, Home, RotateCcw, Trophy } from 'lucide-react'
import { useSessionState } from '@/hooks/useSessionState'
import { rankTeams, getLeaders } from '@/domain/ranking'
import { resolveTiebreaker } from '@/domain/tiebreaker'
import { orderedQuestions } from '@/domain/gameFlow'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState, ErrorState } from '@/components/states'
import { ScoreChart } from '@/components/scoreboard/ScoreChart'
import { RankingList } from '@/components/scoreboard/RankingList'
import { optionLabel } from '@/lib/utils'

export function ResultsPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { state, loading, error, refetch } = useSessionState(sessionId)

  if (loading) return <LoadingState />
  if (error || !state) return <ErrorState message={error ?? 'Няма данни.'} onRetry={refetch} />

  const { template, teams, answers, tiebreakerAnswers } = state
  const ranked = rankTeams(teams, answers)
  const leaders = getLeaders(ranked)
  const ordered = orderedQuestions(template)

  // Tiebreaker resolution (if one occurred).
  const tbValues = new Map<string, number | null>(
    tiebreakerAnswers.map((a) => [a.team_id, a.answer_value]),
  )
  const tiebreakerHappened = tiebreakerAnswers.length > 0 && template.tiebreaker != null
  const tbResult =
    tiebreakerHappened && template.tiebreaker
      ? resolveTiebreaker(
          leaders.map((l) => l.team),
          tbValues,
          template.tiebreaker.correct_value,
          true,
        )
      : null

  const winners = tbResult && tbResult.winners.length > 0 ? tbResult.winners : leaders.map((l) => l.team)
  const isDraw = winners.length > 1

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Winner banner */}
      <Card className="border-accent/40 bg-accent/5">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Trophy className="h-8 w-8" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {isDraw ? 'Споделена победа' : 'Победител'}
          </p>
          <h1 className="text-balance text-3xl font-bold md:text-4xl">
            {winners.map((w) => w.name).join(' & ')}
          </h1>
          <p className="text-muted-foreground">
            {template.game.title} · {leaders[0]?.totalPoints ?? 0} точки
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <Home className="h-4 w-4" />
          Към таблото
        </Button>
        <Button onClick={() => navigate(`/games/${template.game.id}/start`)}>
          <RotateCcw className="h-4 w-4" />
          Нова сесия със същата игра
        </Button>
        {template.game.public_scoreboard_enabled && (
          <Button variant="secondary" asChild>
            <a href={`#/public/${sessionId}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Публично класиране
            </a>
          </Button>
        )}
      </div>

      {/* Final ranking + chart */}
      <Card>
        <CardHeader>
          <CardTitle>Крайно класиране</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ScoreChart ranked={ranked} />
          <RankingList ranked={ranked} />
        </CardContent>
      </Card>

      {/* Tiebreaker result */}
      {tbResult && template.tiebreaker && (
        <Card>
          <CardHeader>
            <CardTitle>Резултат от тайбрекъра</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {template.tiebreaker.question_text} (вярна стойност:{' '}
              {template.tiebreaker.correct_value}
              {template.tiebreaker.unit_label ? ` ${template.tiebreaker.unit_label}` : ''})
            </p>
            <ul className="space-y-1">
              {tbResult.entries.map((entry) => (
                <li
                  key={entry.team.id}
                  className="flex items-center justify-between border-b py-2 last:border-b-0"
                >
                  <span className="font-medium">
                    {entry.team.name}
                    {entry.isWinner && (
                      <Badge variant="success" className="ml-2">
                        Печели
                      </Badge>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Отговор: {entry.answerValue ?? '—'} · разлика:{' '}
                    {entry.difference == null ? '—' : entry.difference}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Per-question breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Разбивка по въпроси</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Отбор
                </th>
                {ordered.map((_, i) => (
                  <th key={i} scope="col" className="px-2 py-2 text-center font-medium">
                    В{i + 1}
                  </th>
                ))}
                <th scope="col" className="pl-3 text-right font-medium">
                  Общо
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row) => (
                <tr key={row.team.id} className="border-b last:border-b-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    {row.team.name}
                  </th>
                  {ordered.map((q) => {
                    const ans = answers.find(
                      (a) => a.question_id === q.id && a.team_id === row.team.id,
                    )
                    return (
                      <td
                        key={q.id}
                        className="px-2 py-2 text-center tabular-nums text-muted-foreground"
                      >
                        {ans ? ans.awarded_points : '—'}
                      </td>
                    )
                  })}
                  <td className="pl-3 text-right font-bold tabular-nums">{row.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Легенда: В1…В{ordered.length} са въпросите по ред. Стойностите са присъдените точки.{' '}
            {ordered.some((q) => q.options.length > 0) && `Отговорите се маркират с ${optionLabel(0)}, ${optionLabel(1)}…`}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
