export function PrBadge({ first = false }: { first?: boolean }) {
  return <span title={first ? 'Pierwszy wynik ustanawia rekord osobisty' : 'Nowy rekord osobisty w dniu treningu'}
    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[10px] font-bold tracking-wide text-amber-200">
    <span aria-hidden="true">★</span> {first ? 'PIERWSZY PR' : 'PR'}
  </span>
}
