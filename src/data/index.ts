import { supabase } from '@/lib/supabase'
import { isLocalMode } from '@/lib/env'
import type { Repository } from './repository'
import { LocalRepository } from './local'
import { SupabaseRepository } from './supabase'

// A single repository instance for the whole app. Chosen once at startup:
// Supabase when configured, otherwise the localStorage demo repository.
export const repository: Repository =
  !isLocalMode && supabase ? new SupabaseRepository(supabase) : new LocalRepository()

export type { Repository } from './repository'
export type { SessionSummary } from './repository'
