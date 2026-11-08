import { useId } from 'react'

export function GymModeToggle({ checked, disabled, onChange }: {
  checked: boolean; disabled: boolean; onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="mb-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
      <input id={id} type="checkbox" aria-label="Siłownia" checked={checked} disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="size-5 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" />
      <span><span className="block font-medium">Siłownia</span><span className="mt-1 block text-xs text-muted">{checked ? 'Ćwiczenia na nogi i pośladki' : 'Ćwiczenia street workout i kalisteniczne'}</span></span>
    </label>
  )
}
