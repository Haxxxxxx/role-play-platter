import { supabase } from '@/lib/supabase'

/**
 * POST JSON to one of the /api/* AI endpoints with the caller's Supabase
 * access token and a hard timeout. Every one of those endpoints calls
 * Gemini, which can queue or stall for a long time (or 503 outright) — an
 * unbounded fetch there just leaves the UI spinning forever, so this caps
 * it and turns a stall into a plain error the caller can surface.
 */
export async function postToApi<T>(path: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('La requête a pris trop de temps — réessayez.', { cause: err })
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  const payload = (await response.json().catch(() => ({}))) as T | { error?: string }
  if (!response.ok || (payload && typeof payload === 'object' && 'error' in payload && payload.error)) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && payload.error
        ? String(payload.error)
        : `La requête a échoué (${response.status}).`
    throw new Error(message)
  }
  return payload as T
}
