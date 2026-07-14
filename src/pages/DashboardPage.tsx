import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  Copy,
  ListChecks,
  Pencil,
  Play,
  Plus,
  Trash2,
  Trophy,
  Eye,
} from 'lucide-react'
import { repository, type SessionSummary } from '@/data'
import { useAuth } from '@/hooks/useAuth'
import type { GameSummary } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { STATUS_LABELS, SESSION_STATUS_LABELS } from '@/lib/constants'

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [games, setGames] = React.useState<GameSummary[]>([])
  const [sessions, setSessions] = React.useState<SessionSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<GameSummary | null>(null)

  const load = React.useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [gameList, sessionList] = await Promise.all([
        repository.listGameSummaries(user.id),
        repository.listSessions(user.id),
      ])
      setGames(gameList)
      setSessions(sessionList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неуспешно зареждане.')
    } finally {
      setLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleDuplicate = async (summary: GameSummary) => {
    if (!user) return
    setBusyId(summary.game.id)
    try {
      const newId = await repository.duplicateGame(summary.game.id, user.id)
      toast({ title: 'Играта е дублирана', description: 'Създадено е копие като чернова.' })
      navigate(`/games/${newId}/edit`)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Грешка при дублиране',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleArchive = async (summary: GameSummary) => {
    setBusyId(summary.game.id)
    try {
      await repository.archiveGame(summary.game.id)
      toast({ title: 'Играта е архивирана' })
      await load()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Грешка при архивиране',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    setBusyId(target.game.id)
    try {
      await repository.deleteGame(target.game.id)
      toast({ title: 'Играта е изтрита' })
      await load()
    } catch (err) {
      // Deletion is blocked when history exists — offer archive instead.
      toast({
        variant: 'destructive',
        title: 'Изтриването не е възможно',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  const recentSessions = sessions.filter((s) => s.session.status !== 'completed').slice(0, 6)
  const completedSessions = sessions.filter((s) => s.session.status === 'completed')

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Табло</h1>
          <p className="text-sm text-muted-foreground">
            Управлявайте своите куиз шаблони и сесии.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/games/new">
            <Plus className="h-5 w-5" />
            Създай игра
          </Link>
        </Button>
      </div>

      <section aria-labelledby="games-heading" className="space-y-4">
        <h2 id="games-heading" className="text-lg font-semibold">
          Шаблони на игри
        </h2>
        {games.length === 0 ? (
          <EmptyState
            title="Все още нямате игри"
            description="Създайте първата си куиз игра, за да започнете."
            action={
              <Button asChild>
                <Link to="/games/new">
                  <Plus className="h-4 w-4" />
                  Създай игра
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((summary) => (
              <GameCard
                key={summary.game.id}
                summary={summary}
                busy={busyId === summary.game.id}
                onDuplicate={() => handleDuplicate(summary)}
                onArchive={() => handleArchive(summary)}
                onDelete={() => setDeleteTarget(summary)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="sessions-heading" className="space-y-4">
        <h2 id="sessions-heading" className="text-lg font-semibold">
          Скорошни сесии
        </h2>
        {recentSessions.length === 0 ? (
          <EmptyState title="Няма активни сесии" description="Стартирайте игра, за да създадете сесия." />
        ) : (
          <div className="overflow-hidden rounded-xl border">
            {recentSessions.map((s) => (
              <SessionRow key={s.session.id} summary={s} onOpen={(p) => navigate(p)} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="history-heading" className="space-y-4">
        <h2 id="history-heading" className="text-lg font-semibold">
          История на завършените игри
        </h2>
        {completedSessions.length === 0 ? (
          <EmptyState title="Все още няма завършени игри" />
        ) : (
          <div className="overflow-hidden rounded-xl border">
            {completedSessions.map((s) => (
              <SessionRow key={s.session.id} summary={s} onOpen={(p) => navigate(p)} completed />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изтриване на „{deleteTarget?.game.title}“?</AlertDialogTitle>
            <AlertDialogDescription>
              Това действие е необратимо. Ако играта има изиграни сесии, изтриването ще бъде
              отказано — използвайте архивиране, за да запазите историята.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Изтрий
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function GameCard({
  summary,
  busy,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  summary: GameSummary
  busy: boolean
  onDuplicate: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const { game, questionCount, roundCount, hasTiebreaker } = summary
  const statusVariant =
    game.status === 'published' ? 'success' : game.status === 'archived' ? 'secondary' : 'outline'

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{game.title}</CardTitle>
          <Badge variant={statusVariant}>{STATUS_LABELS[game.status]}</Badge>
        </div>
        {game.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{game.description}</p>
        )}
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            {questionCount} въпроса · {roundCount} кръга
          </li>
          <li className="flex items-center gap-2">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Тайбрекър: {hasTiebreaker ? 'да' : 'не'}
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Създадена: {formatDate(game.created_at)} · Обновена: {formatDate(game.updated_at)}
        </p>
      </CardHeader>
      <CardFooter className="flex flex-wrap gap-2">
        <Button asChild size="sm" disabled={busy}>
          <Link to={`/games/${game.id}/start`}>
            <Play className="h-4 w-4" />
            Старт
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" disabled={busy}>
          <Link to={`/games/${game.id}/edit`}>
            <Pencil className="h-4 w-4" />
            Редакция
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" disabled={busy}>
          <Link to={`/games/${game.id}/preview`}>
            <Eye className="h-4 w-4" />
            Преглед
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={onDuplicate} disabled={busy}>
          <Copy className="h-4 w-4" />
          Дублирай
        </Button>
        {game.status !== 'archived' && (
          <Button size="sm" variant="ghost" onClick={onArchive} disabled={busy}>
            <Archive className="h-4 w-4" />
            Архивирай
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 className="h-4 w-4" />
          Изтрий
        </Button>
      </CardFooter>
    </Card>
  )
}

function SessionRow({
  summary,
  onOpen,
  completed = false,
}: {
  summary: SessionSummary
  onOpen: (path: string) => void
  completed?: boolean
}) {
  const { session, gameTitle, teamCount } = summary
  const target = completed
    ? `/sessions/${session.id}/results`
    : session.status === 'setup'
      ? `/sessions/${session.id}/setup`
      : `/sessions/${session.id}/play`

  return (
    <div className="flex items-center justify-between gap-4 border-b p-4 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate font-medium">{gameTitle}</p>
        <p className="text-xs text-muted-foreground">
          {teamCount} отбора · {formatDate(session.started_at ?? session.created_at)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={completed ? 'secondary' : 'default'}>
          {SESSION_STATUS_LABELS[session.status]}
        </Badge>
        <Button size="sm" variant="outline" onClick={() => onOpen(target)}>
          {completed ? 'Резултати' : 'Отвори'}
        </Button>
      </div>
    </div>
  )
}
