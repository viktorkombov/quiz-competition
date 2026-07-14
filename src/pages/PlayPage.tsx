import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  Pencil,
} from 'lucide-react'
import { repository } from '@/data'
import { useSessionState } from '@/hooks/useSessionState'
import { scoreAnswer, allTeamsAnswered } from '@/domain/scoring'
import { rankTeams, analyseFirstPlace } from '@/domain/ranking'
import { tiebreakerDifference } from '@/domain/tiebreaker'
import { orderedQuestions, questionIndex } from '@/domain/gameFlow'
import type { TeamAnswerInput, TiebreakerAnswerInput } from '@/data/types'
import type { Tiebreaker } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState, ErrorState } from '@/components/states'
import { QuestionStage } from '@/components/play/QuestionStage'
import { TeamPanel } from '@/components/play/TeamPanel'
import { TiebreakerPanel } from '@/components/play/TiebreakerPanel'
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
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function PlayPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { state, loading, error, refetch } = useSessionState(sessionId)

  const [selections, setSelections] = React.useState<Map<string, string | null>>(new Map())
  const [correcting, setCorrecting] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [confirmReveal, setConfirmReveal] = React.useState(false)
  const [confirmSkip, setConfirmSkip] = React.useState(false)

  // Tiebreaker UI state.
  const [tbRevealed, setTbRevealed] = React.useState(false)
  const [adHoc, setAdHoc] = React.useState<Tiebreaker | null>(null)
  const [adHocOpen, setAdHocOpen] = React.useState(false)

  const currentQuestionId = state?.session.current_question_id ?? null

  // Reset per-question selections whenever the active question changes.
  React.useEffect(() => {
    if (!state) return
    const stored = state.answers.filter((a) => a.question_id === currentQuestionId)
    const map = new Map<string, string | null>()
    for (const team of state.teams) {
      const found = stored.find((a) => a.team_id === team.id)
      map.set(team.id, found ? found.selected_option_id : null)
    }
    setSelections(map)
    setCorrecting(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionId, state?.teams.length, state?.session.status])

  // Infer whether the tiebreaker was already revealed (persisted differences).
  React.useEffect(() => {
    if (state?.session.status === 'tiebreaker') {
      const revealed =
        state.tiebreakerAnswers.length > 0 &&
        state.tiebreakerAnswers.every((a) => a.absolute_difference != null)
      setTbRevealed(revealed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.session.status])

  if (loading) return <LoadingState label="Зареждане на играта…" />
  if (error || !state) return <ErrorState message={error ?? 'Няма данни.'} onRetry={refetch} />

  if (state.session.status === 'setup') {
    return <Navigate to={`/sessions/${sessionId}/setup`} replace />
  }
  if (state.session.status === 'completed' || state.session.status === 'cancelled') {
    return <Navigate to={`/sessions/${sessionId}/results`} replace />
  }

  const { template, teams, answers } = state
  const ordered = orderedQuestions(template)
  const ranked = rankTeams(teams, answers)

  // ---------------------------------------------------------------------
  // Tiebreaker mode
  // ---------------------------------------------------------------------
  if (state.session.status === 'tiebreaker') {
    const tiebreaker = adHoc ?? template.tiebreaker
    const leaders = analyseFirstPlace(ranked).leaders
    const tiedTeams = leaders.map((l) => l.team)
    const initialValues = new Map<string, number | null>(
      state.tiebreakerAnswers.map((a) => [a.team_id, a.answer_value]),
    )

    if (!tiebreaker) {
      return <ErrorState message="Липсва тайбрекър за тази игра." />
    }

    const handleTbReveal = async (values: Map<string, number | null>) => {
      setBusy(true)
      try {
        const inputs: TiebreakerAnswerInput[] = tiedTeams.map((team) => {
          const value = values.get(team.id)
          const answerValue = value == null || Number.isNaN(value) ? Number.NaN : value
          return {
            game_session_id: state.session.id,
            team_id: team.id,
            answer_value: Number.isNaN(answerValue) ? 0 : answerValue,
            absolute_difference:
              value == null || Number.isNaN(value)
                ? null
                : tiebreakerDifference(value, tiebreaker.correct_value),
          }
        })
        await repository.upsertTiebreakerAnswers(inputs)
        setTbRevealed(true)
        await refetch()
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Грешка при запис',
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        setBusy(false)
      }
    }

    const handleComplete = async () => {
      setBusy(true)
      try {
        await repository.updateSessionStatus(state.session.id, 'completed')
        navigate(`/sessions/${sessionId}/results`)
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Грешка при завършване',
          description: err instanceof Error ? err.message : undefined,
        })
        setBusy(false)
      }
    }

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PlayHeader
          title={template.game.title}
          roundTitle="Тайбрекър"
          questionNumber={ordered.length}
          total={ordered.length}
          points={0}
        />
        <TiebreakerPanel
          key={adHoc?.id ?? 'template'}
          tiebreaker={tiebreaker}
          tiedTeams={tiedTeams}
          initialValues={initialValues}
          revealed={tbRevealed}
          saving={busy}
          onReveal={handleTbReveal}
          onDeclareJointWinners={handleComplete}
          onAddAdHocRound={() => setAdHocOpen(true)}
        />
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate(`/sessions/${sessionId}/scoreboard`)}>
            <BarChart3 className="h-4 w-4" />
            Виж класирането
          </Button>
        </div>

        <AdHocTiebreakerDialog
          open={adHocOpen}
          onOpenChange={setAdHocOpen}
          onSubmit={(questionText, value) => {
            setAdHoc({
              id: `adhoc-${value}-${questionText.length}`,
              game_id: template.game.id,
              question_text: questionText,
              correct_value: value,
              unit_label: tiebreaker.unit_label,
              instructions: null,
            })
            setTbRevealed(false)
            setAdHocOpen(false)
          }}
        />
      </div>
    )
  }

  // ---------------------------------------------------------------------
  // Active question mode
  // ---------------------------------------------------------------------
  const rawIndex = questionIndex(template, currentQuestionId)
  const currentIndex = rawIndex >= 0 ? rawIndex : 0
  const currentQuestion = ordered[currentIndex]

  if (!currentQuestion) {
    return <ErrorState message="Играта няма въпроси." />
  }

  const answersForQuestion = answers.filter((a) => a.question_id === currentQuestion.id)
  const revealedPersisted = answersForQuestion.length > 0
  const revealed = revealedPersisted && !correcting
  const locked = revealed
  const isLast = currentIndex === ordered.length - 1
  const round = template.rounds.find((r) => r.id === currentQuestion.round_id)
  const teamIds = teams.map((t) => t.id)
  const everyoneAnswered = allTeamsAnswered(
    teams.map((t) => ({
      // Build synthetic "answers" from current selections to reuse the helper.
      id: t.id,
      game_session_id: state.session.id,
      question_id: currentQuestion.id,
      team_id: t.id,
      selected_option_id: selections.get(t.id) ?? null,
      is_correct: false,
      awarded_points: 0,
      created_at: '',
      updated_at: '',
    })).filter((a) => a.selected_option_id != null),
    currentQuestion.id,
    teamIds,
  )

  const selectedWrongOptionIds = new Set(
    Array.from(selections.values()).filter(
      (id): id is string => id != null && id !== currentQuestion.correct_option_id,
    ),
  )

  const persistReveal = async () => {
    setBusy(true)
    try {
      const inputs: TeamAnswerInput[] = teams.map((team) => {
        const selected = selections.get(team.id) ?? null
        const { isCorrect, awardedPoints } = scoreAnswer(currentQuestion, selected)
        return {
          game_session_id: state.session.id,
          question_id: currentQuestion.id,
          team_id: team.id,
          selected_option_id: selected,
          is_correct: isCorrect,
          awarded_points: awardedPoints,
        }
      })
      // Upsert is idempotent on (session, question, team) so revealing again or
      // reloading never double-counts points.
      await repository.upsertTeamAnswers(inputs)
      setCorrecting(false)
      await refetch()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Грешка при запис на резултата',
        description: err instanceof Error ? err.message : undefined,
      })
      // Roll back optimistic UI by reloading authoritative state.
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const handleRevealClick = () => {
    if (everyoneAnswered) {
      void persistReveal()
    } else {
      setConfirmReveal(true)
    }
  }

  const goToQuestion = async (index: number) => {
    if (index < 0 || index >= ordered.length) return
    setBusy(true)
    try {
      await repository.setCurrentQuestion(state.session.id, ordered[index].id)
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const handleNext = () => {
    if (!revealedPersisted) {
      setConfirmSkip(true)
      return
    }
    void goToQuestion(currentIndex + 1)
  }

  const handleFinish = async () => {
    setBusy(true)
    try {
      const result = analyseFirstPlace(rankTeams(teams, answers))
      if (result.isTie && template.tiebreaker) {
        await repository.updateSessionStatus(state.session.id, 'tiebreaker')
        await refetch()
      } else {
        await repository.updateSessionStatus(state.session.id, 'completed')
        navigate(`/sessions/${sessionId}/results`)
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Грешка при завършване',
        description: err instanceof Error ? err.message : undefined,
      })
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PlayHeader
        title={template.game.title}
        roundTitle={round?.title ?? null}
        questionNumber={currentIndex + 1}
        total={ordered.length}
        points={currentQuestion.points}
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardContent className="pt-6">
            <QuestionStage
              question={currentQuestion}
              revealed={revealed}
              selectedWrongOptionIds={selectedWrongOptionIds}
            />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Отбори</h3>
            {revealedPersisted && !correcting && (
              <Button variant="ghost" size="sm" onClick={() => setCorrecting(true)}>
                <Pencil className="h-4 w-4" />
                Коригирай
              </Button>
            )}
          </div>
          <TeamPanel
            teams={teams}
            question={currentQuestion}
            selections={selections}
            revealed={revealed}
            locked={locked && !correcting}
            onSelect={(teamId, optionId) =>
              setSelections((prev) => new Map(prev).set(teamId, optionId))
            }
          />
        </div>
      </div>

      {/* Host controls */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => void goToQuestion(currentIndex - 1)}
            disabled={currentIndex === 0 || busy}
          >
            <ChevronLeft className="h-4 w-4" />
            Предишен
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {!revealedPersisted || correcting ? (
              <Button onClick={handleRevealClick} disabled={busy} variant="success">
                <Eye className="h-4 w-4" />
                {correcting ? 'Запази корекцията' : 'Разкрий отговора'}
              </Button>
            ) : (
              <Badge variant="success" className="h-9 px-3">
                Отговорът е разкрит
              </Badge>
            )}

            <Button
              variant="outline"
              onClick={() => navigate(`/sessions/${sessionId}/scoreboard`)}
              disabled={busy}
            >
              <BarChart3 className="h-4 w-4" />
              Класиране
            </Button>

            {isLast ? (
              <Button onClick={handleFinish} disabled={busy}>
                <Flag className="h-4 w-4" />
                Завърши играта
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={busy}>
                Следващ
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Reveal with missing answers confirmation */}
      <AlertDialog open={confirmReveal} onOpenChange={setConfirmReveal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Някои отбори нямат отговор</AlertDialogTitle>
            <AlertDialogDescription>
              Не всички отбори имат въведен отговор. Ако продължите, отборите без отговор
              получават 0 точки за този въпрос.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmReveal(false)
                void persistReveal()
              }}
            >
              Разкрий с 0 точки
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Skip unrevealed question confirmation */}
      <AlertDialog open={confirmSkip} onOpenChange={setConfirmSkip}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Въпросът не е разкрит</AlertDialogTitle>
            <AlertDialogDescription>
              Този въпрос още не е разкрит. Ако преминете напред без разкриване, отборите няма
              да получат точки за него.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSkip(false)
                void goToQuestion(currentIndex + 1)
              }}
            >
              Продължи напред
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PlayHeader({
  title,
  roundTitle,
  questionNumber,
  total,
  points,
}: {
  title: string
  roundTitle: string | null
  questionNumber: number
  total: number
  points: number
}) {
  const progress = total > 0 ? Math.round((questionNumber / total) * 100) : 0
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {roundTitle && <p className="text-sm text-muted-foreground">{roundTitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            Въпрос {questionNumber} от {total}
          </Badge>
          <Badge variant="outline">
            {points} {points === 1 ? 'точка' : 'точки'}
          </Badge>
        </div>
      </div>
      <Progress value={progress} aria-label={`Прогрес: въпрос ${questionNumber} от ${total}`} />
    </div>
  )
}

function AdHocTiebreakerDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (questionText: string, value: number) => void
}) {
  const [text, setText] = React.useState('')
  const [value, setValue] = React.useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Нов допълнителен тайбрекър</DialogTitle>
          <DialogDescription>
            Въведете нов числов въпрос за отборите, които все още са изравнени.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adhoc-text">Въпрос</Label>
            <Input id="adhoc-text" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adhoc-value">Вярна числова стойност</Label>
            <Input
              id="adhoc-value"
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              const num = Number(value)
              if (text.trim().length === 0 || Number.isNaN(num)) return
              onSubmit(text.trim(), num)
              setText('')
              setValue('')
            }}
          >
            Стартирай тайбрекъра
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
