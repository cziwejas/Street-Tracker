import { Link, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Trening', icon: 'workouts' },
  { to: '/cwiczenia', label: 'Ćwiczenia', icon: 'exercises' },
  { to: '/progres', label: 'Progres', icon: 'progress' },
  { to: '/ustawienia', label: 'Ustawienia', icon: 'settings' },
]

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Nawigacja główna"
      className="safe-inline safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-3xl grid-cols-4 gap-1 border-t border-white/10 bg-background pt-3"
    >
      {tabs.map(({ to, label, icon }) => {
        const isActive = pathname === to || (to === '/' && pathname.startsWith('/historia'))
        return <Link
          key={to}
          to={to}
          aria-current={isActive ? 'page' : undefined}
          className={
            `flex min-h-16 min-w-11 touch-manipulation flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${
              isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <Icon name={icon} />
          <span>{label}</span>
        </Link>
      })}
    </nav>
  )
}
