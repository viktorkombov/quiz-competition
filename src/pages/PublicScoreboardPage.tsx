import { useParams } from 'react-router-dom'
import { Radio, Trophy } from 'lucide-react'
import { useSessionState } from '@/hooks/useSessionState'
import { rankTeams } from '@/domain/ranking'
import { orderedQuestions, questionIndex } from '@/domain/gameFlow'
import { SESSION_STATUS_LABELS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState, ErrorState } from '@/components/states'
import { ScoreChart } from '@/components/scoreboard/ScoreChart'
import { RankingList } from '@/components/scoreboard/RankingList'

/**
 * Read-only scoreboard for a projector / second screen. No authentication and
 * no controls. Only works when the game has the public scoreboard enabled
 * (enforced by RLS on Supabase and by getPublicSessionState locally). Stays
 * in sync via realtime subscription.
 */
export function PublicScoreboardPage() {
  const { sessionId } = useParams()
  const { state, loading, error, refetch } = useSessionState(sessionId, { publicOnly: true })

  if (loading) return <LoadingState label="Зареждане на класирането…" />
  if (error || !state)
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <ErrorState message={error ?? 'Няма данни.'} onRetry={refetch} />
      </div>
    )

  const { template, teams, answers, session } = state
  const ordered = orderedQuestions(template)
  const rawIndex = questionIndex(template, session.current_question_id)
  const currentNumber = rawIndex >= 0 ? rawIndex + 1 : 0
  const ranked = rankTeams(teams, answers, session.current_question_id)
  const isCompleted = session.status === 'completed'

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Trophy className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {template.game.title}
              </h1>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                На живо
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {SESSION_STATUS_LABELS[session.status]}
            </Badge>
            {!isCompleted && currentNumber > 0 && (
              <Badge variant="outline" className="text-sm">
                Въпрос {currentNumber} от {ordered.length}
              </Badge>
            )}
          </div>
        </header>

        {/* The correct answer is intentionally never shown here — only the
            question position, so the audience cannot see answers early. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">
              {isCompleted ? 'Крайно класиране' : 'Класиране на живо'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {ranked.length === 0 ? (
              <p className="text-muted-foreground">Все още няма отбори.</p>
            ) : (
              <>
                <ScoreChart ranked={ranked} />
                <RankingList ranked={ranked} showLastPoints={!isCompleted} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
