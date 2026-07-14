import * as React from 'react'
import { repository } from '@/data'
import type { SessionState } from '@/types/models'

interface UseSessionStateResult {
  state: SessionState | null
  loading: boolean
  error: string | null
  /** Reload from the repository. */
  refetch: () => Promise<void>
  /** Optimistically replace local state (rolled back by refetch on failure). */
  setState: React.Dispatch<React.SetStateAction<SessionState | null>>
}

/**
 * Loads a full session state and keeps it fresh. Subscribes to realtime
 * changes so refreshing the browser or a second device stays in sync. Passing
 * `publicOnly` uses the public read path (respects public-scoreboard RLS).
 */
export function useSessionState(
  sessionId: string | undefined,
  options: { publicOnly?: boolean } = {},
): UseSessionStateResult {
  const { publicOnly = false } = options
  const [state, setState] = React.useState<SessionState | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!sessionId) {
      setError('Липсва идентификатор на сесия.')
      setLoading(false)
      return
    }
    try {
      const result = publicOnly
        ? await repository.getPublicSessionState(sessionId)
        : await repository.getSessionState(sessionId)
      if (!result) {
        setError(
          publicOnly
            ? 'Публичното класиране не е достъпно за тази сесия.'
            : 'Сесията не е намерена.',
        )
        setState(null)
      } else {
        setState(result)
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неуспешно зареждане на сесията.')
    } finally {
      setLoading(false)
    }
  }, [sessionId, publicOnly])

  React.useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  // Realtime: refetch whenever the session, its answers or teams change.
  React.useEffect(() => {
    if (!sessionId) return
    const unsubscribe = repository.subscribeToSession(sessionId, () => {
      void load()
    })
    return unsubscribe
  }, [sessionId, load])

  return { state, loading, error, refetch: load, setState }
}
