import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface CollectionState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

/**
 * Fetches a table filtered by one column, then subscribes to Postgres
 * realtime changes on that same filter and refetches on any insert / update
 * / delete. This is the primitive every chronicle/party/notes view is built
 * on, so the whole table sees GM edits and AI-structured updates land live.
 *
 * Refetching-on-change (rather than patching individual rows into local
 * state) trades a little efficiency for correctness — campaign-scoped
 * collections are small, and there's no risk of local state drifting from
 * the server after a batch of AI writes.
 */
export function useSupabaseCollection<Row, T>(params: {
  table: string
  filterColumn: string
  filterValue: string | undefined
  orderBy?: { column: string; ascending?: boolean }
  mapRow: (row: Row) => T
}): CollectionState<T> {
  const { table, filterColumn, filterValue, orderBy, mapRow } = params
  const [state, setState] = useState<CollectionState<T>>({ data: [], loading: true, error: null })

  useEffect(() => {
    if (!filterValue) {
      // Resetting to the disabled state, not reacting to an external event.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: [], loading: false, error: null })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))

    async function load() {
      let query = supabase.from(table).select('*').eq(filterColumn, filterValue as string)
      if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
      const { data, error } = await query
      if (cancelled) return
      if (error) {
        setState({ data: [], loading: false, error: error.message })
        return
      }
      setState({ data: (data as Row[]).map(mapRow), loading: false, error: null })
    }

    load()

    const channel = supabase
      .channel(`${table}:${filterColumn}:${filterValue}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `${filterColumn}=eq.${filterValue}` },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filterColumn, filterValue, orderBy?.column, orderBy?.ascending, mapRow])

  return state
}
