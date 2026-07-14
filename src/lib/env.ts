// Reads and validates the Supabase environment configuration.
//
// When both variables are present the app uses Supabase. When either is missing
// the app falls back to LOCAL DEMO MODE (localStorage) and the UI shows a
// banner. Only the publishable/anon key is ever read here — the service-role
// key must never be present in the frontend bundle.

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const supabaseConfig = {
  url,
  anonKey,
}

export const isSupabaseConfigured: boolean = url.length > 0 && anonKey.length > 0

/** True when the app runs against localStorage instead of Supabase. */
export const isLocalMode: boolean = !isSupabaseConfigured
