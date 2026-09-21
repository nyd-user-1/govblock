"use client"

import * as React from "react"

import { stateName } from "@/lib/filters"
import { asDate } from "@/lib/as-date"
import type { PipelineLedgerRow } from "@/lib/pipeline/use-pipeline"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { LoadingFlag } from "@/components/loading-flag"
import { FlagChip } from "@/components/policy/imagery"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Card, CardAction, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// The run log (Brendan, 2026-09-20: "a similar run log table that shows all the
// work you just did per state"), in the Feeds table's form. A row is what one
// run did for one jurisdiction — where it looked for new bills and what it
// found, where it fetched from and how many documents it stored — read off the
// box's own log by scripts/pipeline/ledger.mjs into "PipelineRunStates". The
// first view is each jurisdiction's latest run; the second is every run.

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
function when(iso: string | null) {
  if (!iso) return "—"
  const d = asDate(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} | ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
}
function took(from: string, to: string | null) {
  if (!to) return ""
  const s = Math.max(0, Math.round((asDate(to).getTime() - asDate(from).getTime()) / 1000))
  return s < 90 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

/** Clean: it ended well and nothing was refused. Partial: it ended well and some documents were not had. Failed: it did not end well. */
function status(r: PipelineLedgerRow): { label: string; tone: string } {
  if (r.exit !== 0) return { label: "Failed", tone: "text-destructive" }
  if (r.skipped > 0 || (r.discover_exit ?? 0) !== 0) return { label: "Partial", tone: "text-amber-600" }
  return { label: "Clean", tone: "text-green-600" }
}

const count = (n: number) => (n ? n.toLocaleString("en-US") : "—")

export function RunLedger({ rows, selected, onSelect }: { rows: PipelineLedgerRow[] | undefined; selected: string | null; onSelect: (state: string) => void }) {
  const [view, setView] = React.useState<"latest" | "all">("latest")
  const shown = React.useMemo(() => {
    const list = rows ?? []
    if (view === "all") return list
    // Newest first already: the first row met for a jurisdiction is its latest run.
    const seen = new Set<string>()
    return list.filter((r) => (seen.has(r.state) ? false : (seen.add(r.state), true))).sort((a, b) => a.state.localeCompare(b.state))
  }, [rows, view])

  return (
    <Card className="gap-4">
      <CardHeader className="max-md:px-4">
        <CardAnchor>Run Log</CardAnchor>
        <CardAction>
          <CardTools views={[{ value: "latest", label: "Latest Run by Jurisdiction" }, { value: "all", label: "Every Run" }]} view={view} onView={(v) => setView(v as "latest" | "all")} />
        </CardAction>
      </CardHeader>
      <CardContent className="max-md:px-4">
        {!rows ? (
          <div className="flex h-40 items-center justify-center"><LoadingFlag /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Discovered from</TableHead>
                <TableHead>Fetched from</TableHead>
                <TableHead className="text-right">Documents</TableHead>
                <TableHead className="text-right">Stored</TableHead>
                <TableHead className="text-right">Not had</TableHead>
                <TableHead>Finished</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const s = status(r)
                return (
                  <TableRow key={`${r.run}-${r.started}-${r.state}`} data-state={selected === r.state ? "selected" : undefined} className="cursor-pointer" onClick={() => onSelect(r.state)}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <FlagChip state={r.state} width={28} />
                        <div className="flex flex-col">
                          <span className="font-medium whitespace-nowrap">{stateName(r.state)}</span>
                          <span className="font-mono text-xs text-muted-foreground">{r.run.replace(/^gb-/, "")}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="whitespace-nowrap">{r.discover_source ?? "—"}</span>
                        <span className="max-w-72 truncate text-xs text-muted-foreground" title={r.discover_result ?? undefined}>{r.discover_result ?? (r.discover_source ? "" : "fetch only")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="whitespace-nowrap">{r.fetch_source ?? "—"}</span>
                        {r.note ? <span className="max-w-80 truncate text-xs text-muted-foreground" title={r.note}>{r.note}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{count(r.considered)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", r.stored > 0 && "font-medium text-green-600 dark:text-green-400")}>{count(r.stored)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", r.skipped > 0 && "text-amber-600")}>{count(r.skipped)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{when(r.finished)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{took(r.started, r.finished)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("h-5 gap-1", s.tone)}>
                        {s.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
