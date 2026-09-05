import { useUiStore } from '@/store/useUiStore'

const VARIANT_STYLES: Record<string, string> = {
  info: 'border-arcane-500/40 bg-ink-800',
  success: 'border-emerald-500/40 bg-ink-800',
  error: 'border-red-500/40 bg-ink-800',
}

export function Toaster() {
  const { toasts, dismissToast } = useUiStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismissToast(toast.id)}
          className={`animate-toast-in rounded-lg border px-4 py-3 text-left text-sm shadow-lg transition hover:brightness-110 ${VARIANT_STYLES[toast.variant]}`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}
