import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useToasts } from '../store/toasts'

const TINTS = ['#2540d9', '#2a7654', '#b8362c', '#8a5a00', '#6b3fa0', '#0f6e84']

export function CompanyLogo({ name, src, size = 40 }: { name: string; src?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={style}
        className="shrink-0 rounded-lg border border-line bg-white object-contain p-0.5"
      />
    )
  }
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return (
    <span
      aria-hidden="true"
      style={{ ...style, background: TINTS[hash % TINTS.length], fontSize: size * 0.45 }}
      className="font-display grid shrink-0 place-items-center rounded-lg font-bold text-white"
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

export function formatShortDate(iso: string | undefined): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  return Number.isNaN(t) ? '' : shortDate.format(t)
}

/** The "Applied" mark. It animates only when the application happened a moment ago. */
export function Stamp({ appliedAt }: { appliedAt?: string }) {
  const [fresh] = useState(() => (appliedAt ? Date.now() - Date.parse(appliedAt) < 1500 : false))
  return <span className={`stamp ${fresh ? 'stamp-fresh' : ''}`}>Applied {formatShortDate(appliedAt)}</span>
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, animation: 'spin 700ms linear infinite' }}
      className="inline-block rounded-full border-2 border-current border-r-transparent"
    />
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[rgb(9_14_26/0.55)] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ animation: 'sheet-in 180ms ease-out both' }}
        className={`bg-surface shadow-lift flex max-h-[92dvh] w-full flex-col rounded-t-2xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="border-line flex items-center justify-between gap-4 border-b px-5 py-3">
          <h2 className="text-lg">{title}</h2>
          <button type="button" className="btn btn-quiet btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function Toasts() {
  const { toasts, dismiss } = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{ animation: 'sheet-in 180ms ease-out both' }}
          className={`shadow-lift pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium ${
            t.tone === 'error' ? 'bg-bad text-white' : 'bg-rail text-on-rail'
          }`}
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="text-marigold shrink-0 font-bold underline underline-offset-2"
              onClick={() => {
                t.action?.run()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-lg px-3 py-2 text-sm ${
        tone === 'error' ? 'bg-bad-tint text-bad' : 'bg-action-tint text-ink'
      }`}
    >
      {children}
    </div>
  )
}
