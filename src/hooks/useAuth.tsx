import * as React from 'react'
import { repository } from '@/data'
import type { AuthUser } from '@/data/types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true
    repository
      .getCurrentUser()
      .then((u) => {
        if (active) setUser(u)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const unsubscribe = repository.onAuthChange((u) => {
      if (active) setUser(u)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => {
        const u = await repository.signIn(email, password)
        setUser(u)
      },
      signUp: async (email, password, displayName) => {
        const u = await repository.signUp(email, password, displayName)
        setUser(u)
      },
      signOut: async () => {
        await repository.signOut()
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth трябва да се използва в AuthProvider.')
  return ctx
}
