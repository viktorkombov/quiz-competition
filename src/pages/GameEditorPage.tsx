import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Save, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { repository } from '@/data'
import { useAuth } from '@/hooks/useAuth'
import type { Game, GameTemplate } from '@/types/models'
import { editorSchema, type EditorValues } from '@/lib/validation'
import {
  editorValuesToDraft,
  makeEmptyQuestion,
  templateToEditorValues,
} from '@/lib/editorMapping'
import { createId } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState, ErrorState } from '@/components/states'
import { QuestionCard } from '@/components/editor/QuestionCard'
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

interface GameEditorPageProps {
  mode: 'create' | 'edit'
}

export function GameEditorPage({ mode }: GameEditorPageProps) {
  const { gameId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [loading, setLoading] = React.useState(mode === 'edit')
  const [loadError, setLoadError] = React.useState<string | null>(null)
  // Holds the persisted game record (with id/owner/timestamps).
  const gameRef = React.useRef<Game | null>(null)

  const form = useForm<EditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: templateToEditorValues(null),
    mode: 'onBlur',
  })
  const { control, register, handleSubmit, reset, watch, setValue, formState } = form

  const rounds = useFieldArray({ control, name: 'rounds' })
  const questions = useFieldArray({ control, name: 'questions' })
  const tiebreakerEnabled = watch('tiebreakerEnabled')

  const applyTemplate = React.useCallback(
    (template: GameTemplate | null) => {
      gameRef.current = template?.game ?? null
      reset(templateToEditorValues(template))
    },
    [reset],
  )

  React.useEffect(() => {
    let active = true
    if (mode === 'edit' && gameId) {
      setLoading(true)
      repository
        .getTemplate(gameId)
        .then((template) => {
          if (!active) return
          if (!template) {
            setLoadError('Играта не е намерена.')
          } else if (user && template.game.owner_id !== user.id) {
            setLoadError('Нямате права да редактирате тази игра.')
          } else {
            applyTemplate(template)
          }
        })
        .catch((err) => {
          if (active) setLoadError(err instanceof Error ? err.message : 'Грешка при зареждане.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }
    return () => {
      active = false
    }
  }, [mode, gameId, user, applyTemplate])

  // Warn before leaving with unsaved changes (in-app navigation).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      formState.isDirty &&
      formState.isSubmitSuccessful === false &&
      currentLocation.pathname !== nextLocation.pathname,
  )

  // Warn before closing/reloading the tab.
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (formState.isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [formState.isDirty])

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return
    try {
      let game = gameRef.current
      if (!game) {
        const id = await repository.createGame(user.id, {
          title: values.title.trim(),
          description: values.description.trim() || null,
          status: values.status,
          public_scoreboard_enabled: values.publicScoreboardEnabled,
        })
        const now = new Date().toISOString()
        game = {
          id,
          owner_id: user.id,
          title: values.title.trim(),
          description: values.description.trim() || null,
          status: values.status,
          public_scoreboard_enabled: values.publicScoreboardEnabled,
          created_at: now,
          updated_at: now,
        }
        gameRef.current = game
      }
      const draft = editorValuesToDraft(values, game)
      await repository.saveTemplate(draft)
      // Reset to the just-saved values so the form is no longer dirty.
      reset(values)
      toast({ title: 'Записано', description: 'Промените са запазени успешно.' })
      if (mode === 'create') {
        navigate(`/games/${game.id}/edit`, { replace: true })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Грешка при запис',
        description: err instanceof Error ? err.message : 'Опитайте отново.',
      })
    }
  })

  if (loading) return <LoadingState />
  if (loadError) return <ErrorState message={loadError} />

  const addQuestion = () => questions.append(makeEmptyQuestion(null))

  const duplicateQuestion = (index: number) => {
    const source = watch(`questions.${index}`)
    const clonedOptions = source.options.map((o) => ({ id: createId(), text: o.text }))
    const correctIdx = source.options.findIndex((o) => o.id === source.correctOptionId)
    questions.insert(index + 1, {
      id: createId(),
      roundId: source.roundId,
      text: source.text ? `${source.text} (копие)` : '',
      points: source.points,
      options: clonedOptions,
      correctOptionId: correctIdx >= 0 ? clonedOptions[correctIdx].id : null,
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            aria-label="Назад към таблото"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === 'create' ? 'Нова игра' : 'Редакция на игра'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formState.isDirty ? 'Има незапазени промени' : 'Всичко е записано'}
            </p>
          </div>
        </div>
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          <Save className="h-5 w-5" />
          {formState.isSubmitting ? 'Записване…' : 'Запази'}
        </Button>
      </div>

      {/* General settings */}
      <Card>
        <CardHeader>
          <CardTitle>Общи настройки</CardTitle>
          <CardDescription>Заглавие, описание и видимост на класирането.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Заглавие</Label>
            <Input id="title" {...register('title')} />
            {formState.errors.title && (
              <p className="text-sm text-destructive">{formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea id="description" rows={3} {...register('description')} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="pr-4">
              <Label htmlFor="public-scoreboard">Публично класиране</Label>
              <p className="text-sm text-muted-foreground">
                Позволява показване на класирането без вход (за проектор или екран).
              </p>
            </div>
            <Switch
              id="public-scoreboard"
              checked={watch('publicScoreboardEnabled')}
              onCheckedChange={(v) => setValue('publicScoreboardEnabled', v, { shouldDirty: true })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="pr-4">
              <Label htmlFor="published">Публикувана</Label>
              <p className="text-sm text-muted-foreground">
                Публикуваните игри са готови за стартиране.
              </p>
            </div>
            <Switch
              id="published"
              checked={watch('status') === 'published'}
              onCheckedChange={(v) =>
                setValue('status', v ? 'published' : 'draft', { shouldDirty: true })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Rounds */}
      <Card>
        <CardHeader>
          <CardTitle>Кръгове</CardTitle>
          <CardDescription>
            Кръговете са незадължителни. Играта може да работи и без тях.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rounds.fields.length === 0 && (
            <p className="text-sm text-muted-foreground">Няма добавени кръгове.</p>
          )}
          {rounds.fields.map((field, index) => {
            const roundId = watch(`rounds.${index}.id`)
            const questionsInRound = watch('questions').filter((q) => q.roundId === roundId).length
            return (
              <div key={field.id} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{index + 1}.</span>
                <Input
                  {...register(`rounds.${index}.title`)}
                  placeholder="Заглавие на кръга"
                  aria-label={`Заглавие на кръг ${index + 1}`}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => rounds.move(index, index - 1)}
                  disabled={index === 0}
                  aria-label="Премести кръга нагоре"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => rounds.move(index, index + 1)}
                  disabled={index === rounds.fields.length - 1}
                  aria-label="Премести кръга надолу"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (questionsInRound > 0) {
                      toast({
                        variant: 'destructive',
                        title: 'Кръгът не е празен',
                        description: 'Преместете въпросите от кръга, преди да го изтриете.',
                      })
                      return
                    }
                    rounds.remove(index)
                  }}
                  aria-label="Изтрий кръга"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
          {formState.errors.rounds && (
            <p className="text-sm text-destructive">Проверете заглавията на кръговете.</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => rounds.append({ id: createId(), title: '' })}
          >
            <Plus className="h-4 w-4" />
            Добави кръг
          </Button>
        </CardContent>
      </Card>

      {/* Questions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Въпроси</h2>
            <p className="text-sm text-muted-foreground">
              По подразбиране всеки въпрос има 4 отговора и 1 точка.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={addQuestion}>
            <Plus className="h-4 w-4" />
            Добави въпрос
          </Button>
        </div>
        {typeof formState.errors.questions?.message === 'string' && (
          <p className="text-sm text-destructive">{formState.errors.questions.message}</p>
        )}
        <div className="space-y-4">
          {questions.fields.map((field, index) => (
            <QuestionCard
              key={field.id}
              form={form}
              index={index}
              total={questions.fields.length}
              onRemove={() => questions.remove(index)}
              onDuplicate={() => duplicateQuestion(index)}
              onMove={(dir) => questions.move(index, index + dir)}
            />
          ))}
        </div>
      </section>

      {/* Tiebreaker */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <CardTitle>Тайбрекър</CardTitle>
              <CardDescription>
                Използва се само когато два или повече отбора делят първо място след
                нормалните въпроси.
              </CardDescription>
            </div>
            <Switch
              id="tiebreaker-enabled"
              checked={tiebreakerEnabled}
              onCheckedChange={(v) => setValue('tiebreakerEnabled', v, { shouldDirty: true })}
              aria-label="Включи тайбрекър"
            />
          </div>
        </CardHeader>
        {tiebreakerEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tb-question">Въпрос за тайбрекър</Label>
              <Input id="tb-question" {...register('tiebreaker.questionText')} />
              {formState.errors.tiebreaker?.questionText && (
                <p className="text-sm text-destructive">
                  {formState.errors.tiebreaker.questionText.message}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tb-value">Вярна числова стойност</Label>
                <Input
                  id="tb-value"
                  type="number"
                  step="any"
                  {...register('tiebreaker.correctValue', { valueAsNumber: true })}
                />
                {formState.errors.tiebreaker?.correctValue && (
                  <p className="text-sm text-destructive">
                    {formState.errors.tiebreaker.correctValue.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tb-unit">Мерна единица (напр. „година“)</Label>
                <Input id="tb-unit" {...register('tiebreaker.unitLabel')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tb-instructions">Инструкции (незадължително)</Label>
              <Textarea id="tb-instructions" rows={2} {...register('tiebreaker.instructions')} />
            </div>
          </CardContent>
        )}
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          <Save className="h-5 w-5" />
          {formState.isSubmitting ? 'Записване…' : 'Запази'}
        </Button>
      </div>

      {/* Unsaved-changes navigation guard */}
      <AlertDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Незапазени промени</AlertDialogTitle>
            <AlertDialogDescription>
              Имате незапазени промени. Ако напуснете сега, те ще бъдат загубени.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.state === 'blocked' && blocker.reset()}>
              Остани
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blocker.state === 'blocked' && blocker.proceed()}
            >
              Напусни без запис
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
