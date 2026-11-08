import { useEffect, useId, useRef, type ReactNode } from 'react'

interface WorkoutDialogProps {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
  error?: string | null
}

export function WorkoutDialog({ title, description, children, onClose, busy = false, error }: WorkoutDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element?.showModal()
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="workout-dialog fixed inset-x-0 top-auto mx-auto w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border border-white/10 bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] text-white shadow-2xl backdrop:bg-black/75"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="pt-2 text-xl font-bold tracking-tight">{title}</h2>
          {description && <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        <button type="button" aria-label="Zamknij okno" disabled={busy} onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40">×</button>
      </div>
      {error && <p role="alert" className="workout-error mb-5">{error}</p>}
      {children}
    </dialog>
  )
}
