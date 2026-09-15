"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRightIcon, ChevronDownIcon, PlayIcon } from "lucide-react"

import coverageFile from "@/lib/xml/coverage.generated.json"
import { FRONT_ENDS } from "@/lib/xml/frontends"
import type { CoverageLine } from "@/lib/xml/ir"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { StatDatabaseGrid, type DbStat } from "@/components/admin/blocks/stats"
import { FlagChip } from "@/components/policy/imagery"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// The Compiler (program brief, decision 13): the front ends as a grid, one
// row per jurisdiction and source, with its measured coverage, the dialects
// it met, what fell out, and the profile's units under the row. The numbers
// are lib/xml/coverage.generated.json, written by scripts/xml/coverage.mjs;
// Measure takes a fresh small sample through /api/xml/measure without a
// terminal. The grammar catalogue is docs/xml/grammars on the branch.

type Line = CoverageLine & { fallouts?: Record<string, number> }

const GRAMMARS = "https://github.com/nyd-user-1/govblock/blob/feature/legislative-xml/apps/web/docs/xml/grammars"

const SOURCE_LABEL: Record<string, string> = { documents: "bills, native XML", texts: "bills", laws: "statutes" }

function tone(coverage: number) {
  if (coverage >= 0.95) return "text-emerald-600 dark:text-emerald-400"
  if (coverage >= 0.85) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", value >= 0.95 ? "bg-emerald-500" : value >= 0.85 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

function Row({ line, onMeasure, measuring }: { line: Line; onMeasure: () => void; measuring: boolean }) {
  const [open, setOpen] = React.useState(false)
  const fe = FRONT_ENDS[line.jurisdiction]
  const fallouts = Object.entries(line.fallouts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const unknown = Object.entries(line.unknown ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4)
  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <TableCell className="w-8">
          <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </TableCell>
        <TableCell>
          <span className="flex items-center gap-2">
            <FlagChip state={line.jurisdiction} width={22} className="shrink-0" />
            <span className="font-medium">{line.name}</span>
          </span>
        </TableCell>
        <TableCell className="text-muted-foreground">{SOURCE_LABEL[line.source] ?? line.source}</TableCell>
        <TableCell>
          <span className="flex flex-wrap gap-1">
            {Object.entries(line.dialects ?? {}).map(([d, n]) => (
              <Badge key={d} variant="outline" className="font-mono text-[10px]">
                {d} · {n}
              </Badge>
            ))}
          </span>
        </TableCell>
        <TableCell className="tabular-nums">
          {line.clean} / {line.sampled}
        </TableCell>
        <TableCell>
          <span className="flex items-center gap-2">
            <Bar value={line.coverage} />
            <span className={cn("tabular-nums font-medium", tone(line.coverage))}>{(line.coverage * 100).toFixed(1)}%</span>
          </span>
        </TableCell>
        <TableCell className="max-w-64">
          <span className="flex flex-wrap gap-1">
            {fallouts.map(([k, n]) => (
              <Badge key={k} variant="secondary" className="text-[10px]">
                {k} · {n}
              </Badge>
            ))}
            {unknown.map(([k, n]) => (
              <Badge key={k} variant="destructive" className="font-mono text-[10px]">
                &lt;{k}&gt; · {n}
              </Badge>
            ))}
          </span>
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{line.measuredAt.slice(0, 16).replace("T", " ")}</TableCell>
        <TableCell className="text-right">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={measuring}
            onClick={(e) => {
              e.stopPropagation()
              onMeasure()
            }}
          >
            <PlayIcon className={cn("size-3", measuring && "animate-pulse")} />
            {measuring ? "Measuring" : "Measure"}
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={8} className="py-3">
            <div className="flex flex-col gap-3 text-xs">
              {fe && (
                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="text-muted-foreground">USLM</span>
                  <span className="text-muted-foreground">Signalled by</span>
                  {fe.profile.units.map((u) => (
                    <React.Fragment key={u.name}>
                      <span>{u.name}</span>
                      <code className="font-mono text-[11px]">{u.uslm}</code>
                      <span className="text-muted-foreground">{u.signal}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`${GRAMMARS}/${line.jurisdiction.toLowerCase()}.md`} target="_blank" className="inline-flex items-center gap-1 text-primary hover:underline">
                  Grammar catalogue <ArrowUpRightIcon className="size-3" />
                </Link>
                {Object.keys(line.unknown ?? {}).length > 0 && <span className="text-muted-foreground">Unknown elements are names the USLM vocabulary does not have yet; they are added in lib/xml/uslm-elements.ts.</span>}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function CompilerPage() {
  const [lines, setLines] = React.useState<Record<string, Line>>(() => coverageFile as unknown as Record<string, Line>)
  const [measuring, setMeasuring] = React.useState<string | null>(null)
  const [sort, setSort] = React.useState<"coverage" | "name" | "measured">("coverage")
  const list = React.useMemo(() => {
    const all = Object.values(lines)
    if (sort === "name") return all.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
    if (sort === "measured") return all.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
    return all.sort((a, b) => a.coverage - b.coverage || a.name.localeCompare(b.name))
  }, [lines, sort])
  const jurisdictions = new Set(list.map((l) => l.jurisdiction))
  const mean = list.length ? list.reduce((n, l) => n + l.coverage, 0) / list.length : 0
  const tiles: DbStat[] = [
    { title: "Front ends", value: Object.keys(FRONT_ENDS).length },
    { title: "Jurisdictions measured", value: jurisdictions.size },
    { title: "Documents sampled", value: list.reduce((n, l) => n + l.sampled, 0) },
    { title: "Mean coverage", value: `${(mean * 100).toFixed(1)}%` },
    { title: "At 95% or better", value: list.filter((l) => l.coverage >= 0.95).length },
    { title: "Under 85%", value: list.filter((l) => l.coverage < 0.85).length },
  ]
  const measure = async (line: Line) => {
    const key = `${line.jurisdiction}/${line.source}`
    setMeasuring(key)
    try {
      const res = await fetch(`/api/xml/measure?jurisdiction=${line.jurisdiction}&source=${line.source}&sample=8`)
      if (res.ok) {
        const fresh = (await res.json()) as Line
        setLines((prev) => ({ ...prev, [key]: fresh }))
      }
    } finally {
      setMeasuring(null)
    }
  }
  return (
    <div>
      <div className="mt-4 sm:mt-5">
        <StatDatabaseGrid stats={tiles} />
      </div>
      <div className="mt-4 sm:mt-5">
        <Card className="gap-4">
          <CardHeader>
            <CardAnchor>Front ends</CardAnchor>
            <CardAction>
              <CardTools>
                {(["coverage", "name", "measured"] as const).map((s) => (
                  <Button key={s} variant={sort === s ? "secondary" : "ghost"} size="sm" className="h-7 px-2 text-xs capitalize" onClick={() => setSort(s)}>
                    {s}
                  </Button>
                ))}
              </CardTools>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-8" />
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Dialects</TableHead>
                  <TableHead>Clean</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Fall-outs</TableHead>
                  <TableHead>Measured</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((line) => (
                  <Row key={`${line.jurisdiction}/${line.source}`} line={line} measuring={measuring === `${line.jurisdiction}/${line.source}`} onMeasure={() => void measure(line)} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
