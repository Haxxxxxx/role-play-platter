import { useEffect, useState } from 'react'
import {
  onSnapshot,
  type DocumentData,
  type FirestoreError,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'

interface CollectionState<T> {
  data: T[]
  loading: boolean
  error: FirestoreError | null
}

/**
 * Subscribes to a Firestore query in real time — this is the primitive every
 * chronicle/party/notes view is built on, so the whole table sees GM edits
 * and AI-structured updates land live without a manual refresh.
 */
export function useCollection<T>(
  query: Query<DocumentData> | null,
  mapDoc: (snap: QueryDocumentSnapshot<DocumentData>) => T,
): CollectionState<T> {
  const [state, setState] = useState<CollectionState<T>>({
    data: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!query) {
      // Resetting to the disabled state, not reacting to an external event —
      // the legitimate exception the rule below is aimed at avoiding accidental use of.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: [], loading: false, error: null })
      return
    }
    setState((prev) => ({ ...prev, loading: true }))
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        setState({ data: snapshot.docs.map(mapDoc), loading: false, error: null })
      },
      (error) => {
        setState({ data: [], loading: false, error })
      },
    )
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return state
}
