import { Crown } from 'lucide-react'
import type { RankedTeam } from '@/domain/ranking'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface RankingListProps {
  ranked: RankedTeam[]
  /** Show the "+N" points earned on the most recent question. */
  showLastPoints?: boolean
}

/** Accessible ranked table of teams. Rank is shown as text, not colour. */
export function RankingList({ ranked, showLastPoints = false }: RankingListProps) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Класиране на отборите</caption>
      <thead>
        <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <th scope="col" className="py-2 pr-2 font-medium">
            Място
          </th>
          <th scope="col" className="py-2 pr-2 font-medium">
            Отбор
          </th>
          {showLastPoints && (
            <th scope="col" className="py-2 pr-2 text-right font-medium">
              Последен въпрос
            </th>
          )}
          <th scope="col" className="py-2 text-right font-medium">
            Точки
          </th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((row) => (
          <tr
            key={row.team.id}
            className={cn(
              'border-b transition-colors',
              row.isLeader && 'bg-accent/10',
            )}
          >
            <td className="py-3 pr-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {row.rank}
              </span>
            </td>
            <td className="py-3 pr-2 font-medium">
              <span className="flex items-center gap-2">
                {row.team.name}
                {row.isLeader && (
                  <Badge variant="success" className="gap-1">
                    <Crown className="h-3 w-3" aria-hidden="true" />
                    Водач
                  </Badge>
                )}
              </span>
            </td>
            {showLastPoints && (
              <td className="py-3 pr-2 text-right tabular-nums text-muted-foreground">
                {row.lastQuestionPoints > 0 ? `+${row.lastQuestionPoints}` : '—'}
              </td>
            )}
            <td className="py-3 text-right text-lg font-bold tabular-nums">{row.totalPoints}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
