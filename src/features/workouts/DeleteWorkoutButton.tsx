import { useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { repositories } from '../../db/repositories'
import type { WorkoutSession } from '../../db/types'
import { formatDate } from '../../lib/dates'
import { WorkoutDialog } from './WorkoutDialog'
import { useWorkoutActions } from './useWorkoutActions'

interface DeleteWorkoutProps {
  session: WorkoutSession
  onDeleted?: () => void
}

function DeleteWorkoutDialog({ session, onClose, onDeleted }: DeleteWorkoutProps & { onClose: () => void }) {
  const { busy, error, perform } = useWorkoutActions()

  return <WorkoutDialog title="Usunąć trening?" description={`Trening z ${formatDate(session.date)} zostanie trwale usunięty wraz ze wszystkimi seriami, notatkami i pomiarem masy ciała. Tej operacji nie można cofnąć.`}
    busy={busy} error={error} onClose={onClose}>
    <button type="button" className="workout-button w-full bg-red-400/15 text-red-200" disabled={busy} onClick={() => {
      void perform(async () => {
        await repositories.deleteWorkoutSession(session.id)
        onClose()
        onDeleted?.()
      })
    }}>{busy ? 'Usuwanie…' : 'Usuń trening'}</button>
    <button type="button" className="workout-button mt-2 w-full text-muted" disabled={busy} onClick={onClose}>Anuluj</button>
  </WorkoutDialog>
}

export function DeleteWorkoutButton({ session, onDeleted }: DeleteWorkoutProps) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  function closeDialog() {
    setOpen(false)
    // Restore focus after the modal has unmounted and the page is no longer inert.
    requestAnimationFrame(() => trigger.current?.focus())
  }

  return <>
    <button ref={trigger} type="button" className="workout-button gap-2 text-sm text-red-200 hover:bg-red-400/10"
      aria-label={`Usuń trening z ${formatDate(session.date)}`} onClick={() => setOpen(true)}>
      <Icon name="trash" width={18} height={18} />Usuń trening
    </button>
    {open && <DeleteWorkoutDialog session={session} onClose={closeDialog} onDeleted={onDeleted} />}
  </>
}
