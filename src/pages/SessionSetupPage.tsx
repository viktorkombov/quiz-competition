import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Play } from 'lucide-react'
import { repository } from '@/data'
import { useSessionState } from '@/hooks/useSessionState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingState, ErrorState } from '@/components/states'
import { TeamEditor, validateTeamNames } from '@/components/session/TeamEditor'
import { orderedQuestions } from '@/domain/gameFlow'
import { useToast } from '@/components/ui/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function SessionSetupPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { state, loading, error, refetch } = useSessionState(sessionId)
  const [names, setNames] = React.useState<string[]>([])
  const [starting, setStarting] = React.useState(false)
  const initialised = React.useRef(false)

  React.useEffect(() => {
    if (state && !initialised.current) {
      setNames(state.teams.map((t) => t.name))
      initialised.current = true
    }
  }, [state])

  if (loading) return <LoadingState />
  if (error || !state) return <ErrorState message={error ?? 'Няма данни.'} onRetry={refetch} />

  // If the session already started, resume it instead of re-doing setup.
  if (state.session.status === 'active' || state.session.status === 'tiebreaker') {
    return <Navigate to={`/sessions/${sessionId}/play`} replace />
  }
  if (state.session.status === 'completed') {
    return <Navigate to={`/sessions/${sessionId}/results`} replace />
  }

  const questions = orderedQuestions(state.template)

  const handleStart = async () => {
    if (!sessionId) return
    const validationError = validateTeamNames(names)
    if (validationError) {
      toast({ variant: 'destructive', title: 'Проверете отборите', description: validationError })
      return
    }
    if (questions.length === 0) {
      toast({ variant: 'destructive', title: 'Играта няма въпроси' })
      return
    }
    setStarting(true)
    try {
      const cleanNames = names.map((n) => n.trim()).filter((n) => n.length > 0)
      await repository.replaceTeams(sessionId, cleanNames)
      await repository.setCurrentQuestion(sessionId, questions[0].id)
      await repository.updateSessionStatus(sessionId, 'active')
      navigate(`/sessions/${sessionId}/play`)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Грешка при стартиране',
        description: err instanceof Error ? err.message : undefined,
      })
      setStarting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} aria-label="Назад">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Подготовка на сесията</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{state.template.game.title}</CardTitle>
          <CardDescription>Прегледайте настройките и отборите преди старт.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{questions.length} въпроса</Badge>
          <Badge variant="outline">{state.template.rounds.length} кръга</Badge>
          {state.template.tiebreaker && <Badge variant="outline">Тайбрекър</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Отбори</CardTitle>
          <CardDescription>Можете да добавяте, преименувате, местите и премахвате.</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamEditor names={names} onChange={setNames} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="lg" disabled={starting}>
              <Play className="h-5 w-5" />
              Започни с първия въпрос
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Стартиране на играта?</AlertDialogTitle>
              <AlertDialogDescription>
                Отборите ще бъдат заключени и ще започнете с първия въпрос. Ще можете да
                управлявате играта от екрана на водещия.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отказ</AlertDialogCancel>
              <AlertDialogAction onClick={handleStart}>Започни</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
