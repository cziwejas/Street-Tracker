export function AddedWeightToggle({ id, checked, onChange, disabled = false }: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
    <input id={id} type="checkbox" className="size-5 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span>Wariant z obciążeniem</span>
  </label>
}
