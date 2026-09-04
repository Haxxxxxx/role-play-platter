import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  variant: 'info' | 'success' | 'error'
}

interface UiState {
  toasts: Toast[]
  pushToast: (message: string, variant?: Toast['variant']) => void
  dismissToast: (id: string) => void
}

/** Global, non-persisted UI state (toasts, transient flags). Campaign/chronicle
 * data itself lives in Postgres and streams in via the real-time hooks — it
 * has no business being duplicated into a client store. */
export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  pushToast: (message, variant = 'info') =>
    set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), message, variant }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
