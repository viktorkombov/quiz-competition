// Reads and validates the Supabase environment configuration.
//
// When both variables are present the app uses Supabase. When either is missing
// the app falls back to LOCAL DEMO MODE (localStorage) and the UI shows a
// banner. Only the publishable/anon key is ever read here — the service-role
// key must never be present in the frontend bundle.

// Normalize a pasted Supabase URL. Users sometimes copy the "Data API" URL
// which ends in "/rest/v1" (or leave a trailing slash); supabase-js expects the
// bare project origin, otherwise auth requests become ".../rest/v1/auth/v1/...".
function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '') // drop trailing slash(es)
    .replace(/\/rest\/v1$/i, '') // drop an accidental REST path suffix
    .replace(/\/auth\/v1$/i, '') // ...or an accidental auth path suffix
    .replace(/\/+$/, '')
}

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL ?? '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const supabaseConfig = {
  url,
  anonKey,
}

export const isSupabaseConfigured: boolean = url.length > 0 && anonKey.length > 0

/** True when the app runs against localStorage instead of Supabase. */
export const isLocalMode: boolean = !isSupabaseConfigured
