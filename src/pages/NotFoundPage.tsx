import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">Страницата не е намерена</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Възможно е връзката да е грешна или страницата да е преместена.
      </p>
      <Button asChild>
        <Link to="/dashboard">Към таблото</Link>
      </Button>
    </div>
  )
}
