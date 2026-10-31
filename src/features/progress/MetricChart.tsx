import { lazy, Suspense, useId } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../lib/dates'
import { formatNumber } from './progressHelpers'

const ChartPlot = lazy(() => import('./ChartPlot'))

export interface ChartPoint {
  sessionId: string
  date: string
  value: number | null
  isPr?: boolean
}

interface MetricChartProps {
  title: string
  description: string
  unit: string
  data: ChartPoint[]
  emptyText: string
  color?: string
}

export function MetricChart({ title, description, unit, data, emptyText, color = '#c6f36b' }: MetricChartProps) {
  const titleId = useId()
  const hasValues = data.some((point) => point.value !== null)
  const last = data.filter((point) => point.value !== null).at(-1)
  const hasRecords = data.some((point) => point.isPr)

  return <section className="workout-card min-w-0" aria-labelledby={titleId}>
    <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
      <h3 id={titleId} className="text-base font-semibold">{title}</h3>
      {last?.value !== null && last?.value !== undefined && <p className="text-right"><span className="text-lg font-semibold tabular-nums" style={{ color }}>{formatNumber(last.value)} <span className="text-xs">{unit}</span></span><span className="mt-0.5 block text-[10px] text-muted">ostatni pomiar</span></p>}
    </div>
    <p className="mb-5 text-xs leading-relaxed text-muted">{description}</p>
    {hasValues ? <>
      <div className="min-w-0" aria-label={`${title}. Jednostka: ${unit}. Dane dostępne także w tabeli poniżej.`}>
        <Suspense fallback={<p role="status" className="flex h-55 items-center justify-center text-xs text-muted">Wczytywanie wykresu…</p>}>
          <ChartPlot data={data} title={title} unit={unit} color={color} />
        </Suspense>
      </div>
      {hasRecords && <p className="mt-1 text-[11px] text-amber-200">★ Złote punkty oznaczają PR w dniu treningu.</p>}
      {data.filter((point) => point.value !== null).length === 1 && <p className="mt-2 text-xs text-muted">Pierwszy punkt zapisany. Kolejny trening pokaże kierunek zmian.</p>}
    </> : <p className="rounded-xl border border-dashed border-white/10 px-4 py-7 text-center text-sm leading-relaxed text-muted">{emptyText}</p>}
    {data.length > 0 && <details className="mt-4 border-t border-white/5 pt-1">
      <summary className="chart-data-toggle min-h-11 cursor-pointer content-center rounded-lg text-xs font-medium text-muted">Dane wykresu ({data.length})</summary>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs">
        <caption className="sr-only">{title} — wartości w {unit}</caption>
        <thead className="text-muted"><tr><th scope="col" className="py-2 font-medium">Trening</th><th scope="col" className="py-2 text-right font-medium">Wynik ({unit})</th></tr></thead>
        <tbody>{data.map((point) => <tr className="border-t border-white/5" key={point.sessionId}>
          <td><Link to={`/historia/${point.sessionId}`} className="workout-button justify-start px-0 text-xs text-accent">{formatDate(point.date)}{point.isPr ? ' ★ PR' : ''}</Link></td>
          <td className="py-2 pl-2 text-right tabular-nums">{point.value === null ? 'Brak masy ciała' : formatNumber(point.value)}</td>
        </tr>)}</tbody>
      </table></div>
    </details>}
  </section>
}
