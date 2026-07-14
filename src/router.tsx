import { createHashRouter, Navigate } from 'react-router-dom'
import { ProtectedLayout } from '@/components/layout/ProtectedLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { GameEditorPage } from '@/pages/GameEditorPage'
import { GamePreviewPage } from '@/pages/GamePreviewPage'
import { StartGamePage } from '@/pages/StartGamePage'
import { SessionSetupPage } from '@/pages/SessionSetupPage'
import { PlayPage } from '@/pages/PlayPage'
import { ScoreboardPage } from '@/pages/ScoreboardPage'
import { ResultsPage } from '@/pages/ResultsPage'
import { PublicScoreboardPage } from '@/pages/PublicScoreboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Hash-based routing keeps every URL under "#/…" so refreshing or opening a
// deep link never hits the GitHub Pages 404 handler.
export const router = createHashRouter([
  { index: true, element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/public/:sessionId', element: <PublicScoreboardPage /> },
  {
    element: <ProtectedLayout />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/games/new', element: <GameEditorPage mode="create" /> },
      { path: '/games/:gameId/edit', element: <GameEditorPage mode="edit" /> },
      { path: '/games/:gameId/preview', element: <GamePreviewPage /> },
      { path: '/games/:gameId/start', element: <StartGamePage /> },
      { path: '/sessions/:sessionId/setup', element: <SessionSetupPage /> },
      { path: '/sessions/:sessionId/play', element: <PlayPage /> },
      { path: '/sessions/:sessionId/scoreboard', element: <ScoreboardPage /> },
      { path: '/sessions/:sessionId/results', element: <ResultsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
