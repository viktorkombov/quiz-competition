import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { repository } from '@/data'
import type { GameTemplate } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingState, ErrorState } from '@/components/states'
import { TeamEditor, validateTeamNames } from '@/components/session/TeamEditor'
import { useToast } from '@/components/ui/use-toast'

export function StartGamePage() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [template, setTemplate] = React.useState<GameTemplate | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [names, setNames] = React.useState<string[]>(['Отбор 1', 'Отбор 2'])
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    let active = true
    if (!gameId) return
    repository
      .getTemplate(gameId)
      .then((result) => {
        if (!active) return
        if (!result) setError('Играта не е намерена.')
        else setTemplate(result)
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Грешка.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [gameId])

  const handleStart = async () => {
    if (!gameId) return
    const validationError = validateTeamNames(names)
    if (validationError) {
      toast({ variant: 'destructive', title: 'Проверете отборите', description: validationError })
      return
    }
    setSubmitting(true)
    try {
      const cleanNames = names.map((n) => n.trim()).filter((n) => n.length > 0)
      const sessionId = await repository.createSession({ gameId, teamNames: cleanNames })
      // Previous sessions of the same game stay untouched — a brand new one is
      // created every time.
      navigate(`/sessions/${sessionId}/setup`)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Грешка при създаване на сесия',
        description: err instanceof Error ? err.message : undefined,
      })
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState />
  if (error || !template) return <ErrorState message={error ?? 'Няма данни.'} />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} aria-label="Назад">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Стартиране на игра</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{template.game.title}</CardTitle>
          <CardDescription>{template.game.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{template.questions.length} въпроса</Badge>
          <Badge variant="outline">{template.rounds.length} кръга</Badge>
          {template.tiebreaker && <Badge variant="outline">Тайбрекър</Badge>}
          {template.game.public_scoreboard_enabled && (
            <Badge variant="outline">Публично класиране</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Отбори</CardTitle>
          <CardDescription>Въведете имената на участващите отбори (поне 2).</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamEditor names={names} onChange={setNames} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleStart} disabled={submitting}>
          {submitting ? 'Създаване…' : 'Продължи към подготовка'}
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
