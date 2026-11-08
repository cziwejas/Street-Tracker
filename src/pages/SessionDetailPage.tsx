import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { findPersonalRecords, type PersonalRecord } from '../features/progress/progressHelpers'
import { DeleteWorkoutButton } from '../features/workouts/DeleteWorkoutButton'
import { HistoryStatus } from '../features/workouts/HistoryStatus'
import { SessionDetail } from '../features/workouts/SessionDetail'
import { useHistoryData } from '../features/workouts/useHistoryData'

export function SessionDetailPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { snapshot, retry } = useHistoryData()
  const records = useMemo(() => snapshot.status === 'ready' ? findPersonalRecords(snapshot.data) : new Map<string, PersonalRecord>(), [snapshot])
  const entry = snapshot.status === 'ready' ? snapshot.data.sessions.find(({ session }) => session.id === sessionId) : undefined

  return <div>
    <Link to="/historia" className="workout-button mb-4 -ml-3 text-sm text-muted">← Historia treningów</Link>
    {snapshot.status !== 'ready' ? <><h1 className="mb-6 text-3xl font-bold tracking-tight">Szczegóły treningu</h1><HistoryStatus status={snapshot.status} retry={retry} /></>
      : entry ? <><SessionDetail entry={entry} exercises={snapshot.data.exercises} records={records} />
        <div className="mt-6 border-t border-white/10 pt-4"><DeleteWorkoutButton key={entry.session.id} session={entry.session} onDeleted={() => navigate('/historia', { replace: true })} /></div></>
        : <div className="workout-card"><h1 className="mb-3 text-2xl font-bold">Nie znaleziono treningu</h1><p className="text-sm leading-relaxed text-muted">Ta sesja mogła zostać usunięta lub nie została jeszcze zakończona. Wróć do historii, aby wybrać inny trening.</p></div>}
  </div>
}
