import { createClient } from '@supabase/supabase-js'

// Public client identifiers — safe to ship in the bundle. Row Level Security
// policies (supabase/migrations/0001_init.sql) are what actually gate data
// access, not this URL/key. The service-role key that bypasses RLS lives
// only in the Vercel function environment (api/structure-gm-notes.ts),
// never here.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

// createClient throws synchronously on an empty URL, which would crash the
// whole app at import time before App.tsx gets a chance to show a friendly
// "not configured yet" screen — so fall back to a harmless placeholder and
// gate real usage on isSupabaseConfigured instead.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
)
