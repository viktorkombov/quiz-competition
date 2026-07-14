import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Crown } from 'lucide-react'
import { useSessionState } from '@/hooks/useSessionState'
import { rankTeams, getLeaders } from '@/domain/ranking'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState, ErrorState } from '@/components/states'
import { ScoreChart } from '@/components/scoreboard/ScoreChart'
import { RankingList } from '@/components/scoreboard/RankingList'

export function ScoreboardPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { state, loading, error, refetch } = useSessionState(sessionId)

  if (loading) return <LoadingState />
  if (error || !state) return <ErrorState message={error ?? 'Няма данни.'} onRetry={refetch} />

  if (state.session.status === 'completed') {
    return <Navigate to={`/sessions/${sessionId}/results`} replace />
  }

  const ranked = rankTeams(state.teams, state.answers, state.session.current_question_id)
  const leaders = getLeaders(ranked)
  const hasPoints = ranked.some((r) => r.totalPoints > 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/sessions/${sessionId}/play`)}
            aria-label="Назад към играта"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Междинно класиране</h1>
        </div>
        <Button onClick={() => navigate(`/sessions/${sessionId}/play`)}>Към следващия въпрос</Button>
      </div>

      {hasPoints && leaders.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-accent/15 p-3 text-sm font-medium">
          <Crown className="h-5 w-5 text-accent" aria-hidden="true" />
          {leaders.length === 1
            ? `Водач: ${leaders[0].team.name} (${leaders[0].totalPoints} т.)`
            : `Водачи: ${leaders.map((l) => l.team.name).join(', ')} (${leaders[0].totalPoints} т.)`}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Точки по отбори</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ScoreChart ranked={ranked} />
          <RankingList ranked={ranked} showLastPoints />
        </CardContent>
      </Card>
    </div>
  )
}
