import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingState } from '@/components/states'
import { AppHeader } from './AppHeader'
import { LocalModeBanner } from '@/components/LocalModeBanner'

/** Wraps administration routes and requires an authenticated user. */
export function ProtectedLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen">
        <LoadingState label="Проверка на достъпа…" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LocalModeBanner />
      <AppHeader />
      <main className="container flex-1 py-6 md:py-10">
        <Outlet />
      </main>
    </div>
  )
}
