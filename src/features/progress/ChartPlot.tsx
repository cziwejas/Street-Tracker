import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../../lib/dates'
import type { ChartPoint } from './MetricChart'
import { formatNumber } from './progressHelpers'

export default function ChartPlot({ data, title, unit, color }: { data: ChartPoint[]; title: string; unit: string; color: string }) {
  const pointsById = new Map(data.map((point) => [point.sessionId, point]))

  return <ResponsiveContainer width="100%" height={220} minWidth={0}>
    <LineChart data={data} margin={{ top: 16, right: 10, bottom: 4, left: -10 }} accessibilityLayer>
      <CartesianGrid stroke="#ffffff0d" vertical={false} />
      <XAxis dataKey="sessionId" tickFormatter={(id: string) => {
        const point = pointsById.get(id)
        return point ? formatDate(point.date, true) : ''
      }} stroke="#98a3ad" tickLine={false} axisLine={false} minTickGap={32} tick={{ fontSize: 10 }} />
      <YAxis stroke="#98a3ad" tickLine={false} axisLine={false} width={62} tick={{ fontSize: 10 }}
        tickFormatter={(value: number) => value.toLocaleString('pl-PL', { notation: 'compact', maximumFractionDigits: 1 })} domain={unit === 'kg' ? ['auto', 'auto'] : [0, 'auto']} />
      <Tooltip contentStyle={{ background: '#151a1f', border: '1px solid #ffffff26', borderRadius: 12, fontSize: 12 }}
        labelStyle={{ color: '#f5f7f8', marginBottom: 5 }}
        labelFormatter={(id) => {
          const point = pointsById.get(String(id))
          return point ? `${formatDate(point.date)}${point.isPr ? ' · PR' : ''}` : ''
        }}
        formatter={(value) => [`${formatNumber(Number(value))} ${unit}`, title]} />
      <Line dataKey="value" name={title} type="linear" stroke={color} strokeWidth={2.5} connectNulls={false}
        dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 6, stroke: '#101418', strokeWidth: 2 }} isAnimationActive={false} />
      {data.filter((point) => point.isPr && point.value !== null).map((point) =>
        <ReferenceDot key={point.sessionId} x={point.sessionId} y={point.value ?? 0} r={5} fill="#fcd34d" stroke="#101418" strokeWidth={2} />)}
    </LineChart>
  </ResponsiveContainer>
}
