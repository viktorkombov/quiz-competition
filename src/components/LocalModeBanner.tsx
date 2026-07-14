import { Database } from 'lucide-react'
import { repository } from '@/data'

/**
 * Clearly indicates that the app is running against localStorage because no
 * Supabase configuration was provided.
 */
export function LocalModeBanner() {
  if (!repository.isLocal) return null
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground"
    >
      <Database className="h-3.5 w-3.5" aria-hidden="true" />
      <span>
        Демо режим — данните се пазят локално в браузъра. Задайте Supabase променливи за
        реална база данни.
      </span>
    </div>
  )
}
