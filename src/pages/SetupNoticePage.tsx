export function SetupNoticePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-3xl text-parchment-100">Supabase isn't wired up yet</h1>
      <p className="max-w-md text-parchment-200/70">
        Copy <code className="rounded bg-ink-800 px-1.5 py-0.5">.env.example</code> to{' '}
        <code className="rounded bg-ink-800 px-1.5 py-0.5">.env.local</code>, fill in{' '}
        <code className="rounded bg-ink-800 px-1.5 py-0.5">VITE_SUPABASE_URL</code> and{' '}
        <code className="rounded bg-ink-800 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code> from your Supabase
        project's API settings, then restart the dev server. Full steps are in the README.
      </p>
    </div>
  )
}
