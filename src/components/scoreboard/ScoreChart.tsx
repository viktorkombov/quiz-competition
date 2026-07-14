import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import type { RankedTeam } from '@/domain/ranking'

interface ScoreChartProps {
  ranked: RankedTeam[]
}

/**
 * Responsive horizontal bar chart of team totals. Leaders use the accent
 * colour; the numeric value is also printed on each bar so meaning is never
 * conveyed by colour alone.
 */
export function ScoreChart({ ranked }: ScoreChartProps) {
  if (ranked.length === 0) return null

  const data = ranked.map((r) => ({
    name: r.team.name,
    points: r.totalPoints,
    isLeader: r.isLeader,
  }))
  const maxPoints = Math.max(1, ...data.map((d) => d.points))
  const chartHeight = Math.max(140, ranked.length * 52)

  return (
    <div style={{ width: '100%', height: chartHeight }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
          barCategoryGap={12}
        >
          <XAxis type="number" domain={[0, maxPoints]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 13, fill: 'hsl(var(--foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <Bar dataKey="points" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.isLeader ? 'hsl(var(--accent))' : 'hsl(var(--primary))'}
              />
            ))}
            <LabelList
              dataKey="points"
              position="right"
              style={{ fill: 'hsl(var(--foreground))', fontSize: 13, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
