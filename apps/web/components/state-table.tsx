import Link from "next/link"

import type { IndexRow } from "@/lib/policy/state-index"
import { FlagChip } from "@/components/policy/imagery"
import { Skeleton } from "@govblock/ui/components/ny4/skeleton"

// The jurisdictions table (Brendan, 2026-09-18): /state draws it, and the root
// page's second section draws it in place of the cards when a reader picks the
// table. Each count is its own link, drawn like the name beside it; the first
// session's year opens that session's bills. A member count of 0 prints as a
// dash, unlinked, as a missing year does: Wisconsin's current session is 2026,
// two bills old, and its roster is filed under 2025, so nobody there reads as
// sitting yet. The table keeps its own look rather than typeset's.

const LINK = "no-underline hover:underline"
const CELL = "py-2 pr-4 text-right tabular-nums"

function Head() {
  return (
    <thead>
      <tr className="border-b text-left text-xs text-muted-foreground">
        <th className="py-2 pr-4 font-medium">Jurisdiction</th>
        <th className="py-2 pr-4 font-medium">Since</th>
        <th className="py-2 pr-4 text-right font-medium">Bills</th>
        <th className="py-2 pr-4 text-right font-medium">Laws</th>
        <th className="py-2 text-right font-medium">Members</th>
      </tr>
    </thead>
  )
}

export function StateTable({ rows }: { rows: IndexRow[] }) {
  return (
    <div data-not-typeset="true" className="overflow-x-auto">
      <table className="w-full text-sm">
        <Head />
        <tbody>
          {rows.map((r) => {
            const code = r.state.toLowerCase()
            return (
              <tr key={r.state} className="border-b">
                <td className="py-2 pr-4">
                  <Link href={`/state/${code}`} className="flex items-center gap-2 no-underline hover:underline">
                    <FlagChip state={r.state} width={24} />
                    {r.name}
                  </Link>
                </td>
                <td className="py-2 pr-4 tabular-nums">
                  {r.firstSession ? <Link href={`/bills/${code}?session=${r.firstSession}`} className={LINK}>{r.firstSession}</Link> : "—"}
                </td>
                <td className={CELL}>
                  <Link href={`/bills/${code}`} className={LINK}>{r.bills.toLocaleString()}</Link>
                </td>
                <td className={CELL}>
                  <Link href={`/laws/${code}`} className={LINK}>{r.laws.toLocaleString()}</Link>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {r.members > 0 ? <Link href={`/members?state=${r.state}`} className={LINK}>{r.members.toLocaleString()}</Link> : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// What stands in while the rows are on their way: the same head, then one row
// per jurisdiction at the real row's height — a flag, a name, a year and three
// counts, each bar about as wide as what lands in it — so nothing moves when
// the table arrives. Widths cycle so the column reads as names, not a block.
const NAMES = [72, 60, 52, 64, 56, 76, 68, 84, 60, 88, 56, 64, 48, 80]
const COUNTS = [
  [52, 44, 24],
  [44, 44, 24],
  [36, 44, 20],
  [44, 52, 24],
  [44, 36, 24],
]

export function StateTableSkeleton({ rows = 52 }: { rows?: number }) {
  return (
    <div data-not-typeset="true" aria-hidden className="overflow-x-auto">
      <table className="w-full text-sm">
        <Head />
        <tbody>
          {Array.from({ length: rows }, (_, i) => {
            const [bills, laws, members] = COUNTS[i % COUNTS.length]!
            return (
              <tr key={i} className="border-b">
                <td className="py-2 pr-4">
                  <div className="flex h-5 items-center gap-2">
                    <Skeleton className="h-4 w-6 rounded-[4px]" />
                    <Skeleton className="h-3.5" style={{ width: NAMES[i % NAMES.length] }} />
                  </div>
                </td>
                <td className="py-2 pr-4">
                  <Skeleton className="h-3.5 w-8" />
                </td>
                {[bills, laws].map((width, j) => (
                  <td key={j} className="py-2 pr-4">
                    <Skeleton className="ml-auto h-3.5" style={{ width }} />
                  </td>
                ))}
                <td className="py-2">
                  <Skeleton className="ml-auto h-3.5" style={{ width: members }} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
