import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabaseConfig } from './env'

// A single shared client. Only created when Supabase is configured; in local
// demo mode this stays null and the LocalRepository is used instead.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null
