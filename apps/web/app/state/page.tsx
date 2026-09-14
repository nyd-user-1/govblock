import type { Metadata } from "next"
import Link from "next/link"

import { getStateIndex } from "@/lib/policy/state-index"
import { FlagChip } from "@/components/policy/imagery"
import { cn } from "@govblock/ui/lib/utils"

// /state (Brendan, 2026-09-13): every jurisdiction on one page — sessions on
// record, bills, and the current roster against the seats — with the door
// to each hub and its charts. The page to see the whole record at once.
export const revalidate = 3600
export const metadata: Metadata = { title: "Jurisdictions", description: "Every legislature on the record: sessions, bills, seats." }

export default async function StateIndexPage() {
  const rows = await getStateIndex()
  const totalBills = rows.reduce((t, r) => t + r.bills, 0)
  const totalSessions = rows.reduce((t, r) => t + r.sessions, 0)
  return (
    <div className="container-wrapper flex flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Jurisdictions</h1>
        <p className="text-muted-foreground">
          {rows.length} legislatures · {totalSessions.toLocaleString()} sessions · {totalBills.toLocaleString()} bills. A roster short of its seats is drawn in red.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Jurisdiction</th>
              <th className="py-2 pr-4 font-medium">Since</th>
              <th className="py-2 pr-4 text-right font-medium">Sessions</th>
              <th className="py-2 pr-4 text-right font-medium">Bills</th>
              <th className="py-2 pr-4 font-medium">Current</th>
              <th className="py-2 pr-4 font-medium">Roster / seats</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.state} className="border-b">
                <td className="py-2 pr-4">
                  <Link href={`/state/${r.state.toLowerCase()}`} className="flex items-center gap-2 no-underline hover:underline">
                    <FlagChip state={r.state} width={24} />
                    {r.name}
                  </Link>
                </td>
                <td className="py-2 pr-4 tabular-nums">{r.firstSession ?? "—"}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.sessions}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.bills.toLocaleString()}</td>
                <td className="py-2 pr-4 tabular-nums">{r.current ?? "—"}</td>
                <td className="py-2 pr-4">
                  <span className="flex flex-wrap gap-3">
                    {r.chambers.map((c) => (
                      <span key={c.chamber} className={cn("tabular-nums", c.seats != null && c.roster < c.seats * 0.9 && "text-[#b31942]")}>
                        {c.chamber} {c.roster}
                        {c.seats != null ? ` / ${c.seats}` : ""}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="py-2">
                  <Link href={`/state/${r.state.toLowerCase()}/charts`} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
                    Charts
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
