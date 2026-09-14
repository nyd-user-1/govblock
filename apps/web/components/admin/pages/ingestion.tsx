"use client"

import * as React from "react"
import { PlayIcon, RefreshCwIcon, RotateCcwIcon, XIcon, ArrowUpToLineIcon } from "lucide-react"

import { fmtCompact } from "@/lib/format"
import { stateName, STATE_CODES } from "@/lib/filters"
import { useProvenance } from "@/components/admin/data"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { StatDatabaseGrid, type DbStat } from "@/components/admin/blocks/stats"
import { FlagChip } from "@/components/policy/imagery"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Input } from "@govblock/ui/components/nova/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@govblock/ui/components/nova/tabs"
import { cn } from "@govblock/ui/lib/utils"
import type { JobLine, PipelineStatus } from "@/lib/policy/expressions"

// Ingestion: the Data Pipeline page's frame, repurposed (Brendan, 2026-09-14)
// as the monitor of the legislative XML program until it is done and the
// control surface for the nightly run after. The store in S3 and its index,
// the queue the controller on the pipeline box reads, the run controls that
// write to it, the measured rate and the finish it implies, coverage per
// front end, what fell out, and each window's report. Reads every fifteen
// seconds while open.

type Coverage = Record<string, { jurisdiction: string; name: string; source: string; sampled: number; clean: number; coverage: number; unknown: Record<string, number>; measuredAt: string }>
type Status = PipelineStatus & { coverage: Coverage; reports: { name: string; body: string }[] }

// The corpus as measured on 2026-09-14 (apps/web/docs/xml/window-2.md): state
// printings, federal printings of the 113th–119th, state and federal sections.
const CORPUS_ESTIMATE = 5_000_000

const JURISDICTIONS = STATE_CODES.map((code) => ({ value: code === "US" ? "us" : `us-${code.toLowerCase()}`, code, label: stateName(code) }))
const jurisOf = (j: string) => (j === "us" ? "US" : j.replace(/^us-/, "").toUpperCase())

const STATUS_TONE: Record<string, string> = {
  running: "text-blue-600",
  queued: "text-muted-foreground",
  waiting: "text-amber-600",
  done: "text-green-600",
  failed: "text-destructive",
  blocked: "text-amber-700",
  cancelled: "text-muted-foreground",
}

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
function fmtWhen(value: string | null | undefined) {
  if (!value) return "—"
  const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}${/[+Z]/.test(value) ? "" : "Z"}`)
  if (!Number.isFinite(d.getTime())) return value
  return `${MONTHS[d.getMonth()]} ${d.getDate()} | ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
}
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`)
const unitLabel = (job: Pick<JobLine, "kind" | "unit" | "jurisdiction">) => (job.unit === "*" ? "every law" : job.kind === "bill" && job.jurisdiction === "us" ? `${Math.floor((Number(job.unit) - 1789) / 2) + 1}th Congress` : job.unit)

function useStatus(tick: number) {
  const [state, setState] = React.useState<{ data?: Status; error?: string; pending: boolean }>({ pending: true })
  React.useEffect(() => {
    let cancelled = false
    const read = async () => {
      setState((s) => ({ ...s, pending: true }))
      try {
        const r = await fetch("/api/xml/status", { cache: "no-store" })
        const body = await r.json()
        if (!cancelled) setState(r.ok ? { data: body, pending: false } : { error: body.error ?? `HTTP ${r.status}`, pending: false })
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, error: String(e), pending: false }))
      }
    }
    void read()
    const id = setInterval(read, 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [tick])
  return state
}

async function send(method: "POST" | "PATCH", body: unknown) {
  const r = await fetch("/api/xml/jobs", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  return r.json()
}

export function IngestionPage() {
  const [tick, setTick] = React.useState(0)
  const { data: s, error, pending } = useStatus(tick)
  const refresh = () => setTick((t) => t + 1)

  const rate5 = s ? (s.rates.find((r) => r.minutes === 5)?.built ?? 0) / 300 : 0
  const rate60 = s ? (s.rates.find((r) => r.minutes === 60)?.built ?? 0) / 3600 : 0
  const rate = rate5 || rate60
  const queued = s ? s.queue.filter((q) => q.status === "queued" || q.status === "running").reduce((n, q) => n + q.jobs, 0) : 0
  const remaining = s ? Math.max(0, CORPUS_ESTIMATE - s.totals.expressions) : 0
  const finish = rate > 0 && queued > 0 ? new Date(Date.now() + (remaining / rate) * 1000) : null

  const tiles: DbStat[] = [
    { title: "Expressions", value: s ? fmtCompact(s.totals.expressions, false) : <Skeleton className="h-7 w-16" /> },
    { title: "Works", value: s ? fmtCompact(s.totals.works, false) : <Skeleton className="h-7 w-16" /> },
    { title: "Jurisdictions", value: s ? s.totals.jurisdictions : <Skeleton className="h-7 w-12" /> },
    { title: "Per Second", value: s ? rate.toFixed(0) : <Skeleton className="h-7 w-12" /> },
    { title: "Jobs Open", value: s ? queued.toLocaleString() : <Skeleton className="h-7 w-12" /> },
    { title: "Finish", value: s ? (finish ? finish.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : queued ? "—" : "Done") : <Skeleton className="h-7 w-16" /> },
  ]

  const refreshButton = (
    <Button variant="outline" size="sm" className="gap-1 max-2xl:size-9" onClick={refresh} disabled={pending && !s}>
      <RefreshCwIcon className={cn("size-3.5", pending && s && "animate-spin")} />
      <span className="max-2xl:hidden">Refresh</span>
    </Button>
  )

  if (error && !s)
    return (
      <Card className="mt-4 sm:mt-5">
        <CardContent className="py-6 text-sm text-muted-foreground">{error}</CardContent>
      </Card>
    )

  return (
    <div>
      <div className="mt-4 sm:mt-5">
        <StatDatabaseGrid stats={tiles} />
      </div>

      <div className="mt-4 sm:mt-5">
        <RunControls onQueued={refresh} />
      </div>

      <div className="mt-4 sm:mt-5">
        <Card className="gap-4">
          <CardHeader className="max-md:px-4">
            <CardAnchor>Queue</CardAnchor>
            <CardAction>
              <CardTools>{refreshButton}</CardTools>
            </CardAction>
          </CardHeader>
          <CardContent className="max-md:px-4">
            <Tabs defaultValue="running">
              <TabsList>
                <TabsTrigger value="running">Running {s ? `(${s.running.length})` : ""}</TabsTrigger>
                <TabsTrigger value="attention">Waiting and Failed {s ? `(${s.attention.length})` : ""}</TabsTrigger>
                <TabsTrigger value="recent">Finished</TabsTrigger>
                <TabsTrigger value="summary">By Jurisdiction</TabsTrigger>
              </TabsList>
              <TabsContent value="running">
                <JobTable jobs={s?.running} onChange={refresh} />
              </TabsContent>
              <TabsContent value="attention">
                <JobTable jobs={s?.attention} onChange={refresh} actions />
              </TabsContent>
              <TabsContent value="recent">
                <JobTable jobs={s?.recent} onChange={refresh} actions />
              </TabsContent>
              <TabsContent value="summary">
                <QueueGrid status={s} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 sm:mt-5">
        <Card className="gap-4">
          <CardHeader className="max-md:px-4">
            <CardAnchor>Store</CardAnchor>
          </CardHeader>
          <CardContent className="max-md:px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Expressions</TableHead>
                  <TableHead className="text-right">Works</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Native XML</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                  <TableHead className="text-right">Stored</TableHead>
                  <TableHead>Last Built</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!s
                  ? Array.from({ length: 4 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={9}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : s.store.map((line) => (
                      <TableRow key={`${line.jurisdiction}-${line.kind}`}>
                        <TableCell className="whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            <FlagChip state={jurisOf(line.jurisdiction)} width={20} />
                            {stateName(jurisOf(line.jurisdiction))}
                          </span>
                        </TableCell>
                        <TableCell className="capitalize">{line.kind === "bill" ? "bills" : "statutes"}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.expressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.works.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.kind === "bill" ? line.sessions : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(line.native / Math.max(1, line.expressions))}</TableCell>
                        <TableCell className="text-right tabular-nums">{pct(line.coverage)}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{`${(line.gz_bytes / 1e9).toFixed(2)} GB`}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmtWhen(line.last_built)}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-2">
        <Card className="gap-4">
          <CardHeader>
            <CardAnchor>Coverage</CardAnchor>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Front End</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Sampled</TableHead>
                  <TableHead className="text-right">Clean</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                  <TableHead>Unknown Elements</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(s?.coverage ?? {}).map(([key, c]) => (
                  <TableRow key={key}>
                    <TableCell className="whitespace-nowrap">{stateName(c.jurisdiction)}</TableCell>
                    <TableCell>{c.source}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.sampled}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.clean}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(c.coverage)}</TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs text-muted-foreground">{Object.keys(c.unknown).slice(0, 6).join(" ") || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <CardAnchor>Fall-outs</CardAnchor>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                  <TableHead>Example</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(s?.fallouts ?? []).map((f) => (
                  <TableRow key={`${f.jurisdiction}-${f.stage}-${f.reason}`}>
                    <TableCell className="whitespace-nowrap">{stateName(jurisOf(f.jurisdiction))}</TableCell>
                    <TableCell>{f.stage}</TableCell>
                    <TableCell className="max-w-56 truncate">{f.reason}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.samples}</TableCell>
                    <TableCell className="max-w-56 truncate font-mono text-xs text-muted-foreground">{f.example ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 sm:mt-5">
        <Card className="gap-4">
          <CardHeader className="max-md:px-4">
            <CardAnchor>Runs</CardAnchor>
          </CardHeader>
          <CardContent className="max-md:px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Run</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Done</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Built</TableHead>
                  <TableHead className="text-right">Fell Out</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(s?.runs ?? []).map((r) => (
                  <TableRow key={r.run}>
                    <TableCell className="font-medium whitespace-nowrap">{r.run}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.jobs.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.done.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.failed.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{(r.built ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{(r.fell_out ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtWhen(r.started)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtWhen(r.finished)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 sm:mt-5">
        <NightlyFeeds lastXml={s?.runs.find((r) => r.run.startsWith("nightly-")) ?? null} />
      </div>

      {s?.reports.length ? (
        <div className="mt-4 sm:mt-5">
          <Card className="gap-4">
            <CardHeader className="max-md:px-4">
              <CardAnchor>Reports</CardAnchor>
            </CardHeader>
            <CardContent className="max-md:px-4">
              <Tabs defaultValue={s.reports[0].name}>
                <TabsList className="flex-wrap">
                  {s.reports.map((r) => (
                    <TabsTrigger key={r.name} value={r.name}>
                      {r.name.replace(/\.md$/, "")}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {s.reports.map((r) => (
                  <TabsContent key={r.name} value={r.name}>
                    <pre className="max-h-[36rem] overflow-auto rounded-lg border bg-muted/30 p-4 font-sans text-sm whitespace-pre-wrap">{r.body}</pre>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The whole nightly ingestion as the record shows it: each feed's last write
 * (the Data Pipeline page's provenance), with the XML step as the last line.
 * The other feeds run from the worker box's manifest (livingston
 * ops/box/jobs.d); their controls are there, the XML step's are above.
 */
function NightlyFeeds({ lastXml }: { lastXml: PipelineStatus["runs"][number] | null }) {
  const prov = useProvenance()
  const f = prov.data?.feeds
  const rows = [
    { name: "LegiScan delta", runsOn: "worker box", at: f?.legiscan_delta_at },
    { name: "National sweep", runsOn: "worker box, Sunday", at: f?.legiscan_at },
    { name: "Congress.gov and GovInfo", runsOn: "worker box", at: f?.congress_at },
    { name: "Text walk and delta", runsOn: "worker box", at: f?.texts_at },
    { name: "Laws", runsOn: "cron", at: f?.laws_at },
    { name: "House directory", runsOn: "cron", at: f?.house_at },
    { name: "Senate contact", runsOn: "cron", at: f?.senate_at },
    { name: "Legislative XML", runsOn: "pipeline box", at: lastXml?.finished ?? null },
  ]
  const tone = (at: string | null | undefined) => {
    if (!at) return { label: "No run on record", className: "text-muted-foreground" }
    const hours = (Date.now() - new Date(at.includes("T") ? at : `${at.replace(" ", "T")}${/[+Z]/.test(at) ? "" : "Z"}`).getTime()) / 36e5
    return hours < 36 ? { label: "Ran last night", className: "text-green-600" } : hours < 24 * 8 ? { label: "This week", className: "text-amber-600" } : { label: "Stale", className: "text-destructive" }
  }
  return (
    <Card className="gap-4">
      <CardHeader className="max-md:px-4">
        <CardAnchor>Nightly Ingestion</CardAnchor>
      </CardHeader>
      <CardContent className="max-md:px-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead>Feed</TableHead>
              <TableHead>Runs On</TableHead>
              <TableHead>Last Write</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const t = tone(r.at)
              return (
                <TableRow key={r.name}>
                  <TableCell className="font-medium whitespace-nowrap">{r.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.runsOn}</TableCell>
                  <TableCell className="whitespace-nowrap">{prov.data || r.name === "Legislative XML" ? fmtWhen(r.at) : <Skeleton className="h-4 w-24" />}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("h-5", t.className)}>
                      {t.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function RunControls({ onQueued }: { onQueued: () => void }) {
  const [jurisdiction, setJurisdiction] = React.useState("all-states")
  const [kind, setKind] = React.useState<"bill" | "statute">("bill")
  const [units, setUnits] = React.useState("")
  const [now, setNow] = React.useState(false)
  const [again, setAgain] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setResult(null)
    const jurisdictions = jurisdiction === "all-states" ? JURISDICTIONS.filter((j) => j.value !== "us").map((j) => j.value) : jurisdiction === "all" ? JURISDICTIONS.map((j) => j.value) : [jurisdiction]
    const body = await send("POST", { jurisdictions, kind, units: units.split(",").map((u) => u.trim()).filter(Boolean), now, again }).catch((e) => ({ error: String(e) }))
    setResult(body.error ? body.error : `${body.queued} queued · ${body.open} already open · ${body.skipped} already built`)
    setBusy(false)
    onQueued()
  }

  const label = jurisdiction === "all-states" ? "Every state" : jurisdiction === "all" ? "Every jurisdiction" : (JURISDICTIONS.find((j) => j.value === jurisdiction)?.label ?? jurisdiction)
  return (
    <Card className="gap-4">
      <CardHeader className="max-md:px-4">
        <CardAnchor>Run</CardAnchor>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3 max-md:px-4">
        <Select value={jurisdiction} onValueChange={(v) => v && setJurisdiction(v)}>
          <SelectTrigger className="h-8 w-48" size="sm" aria-label="Jurisdiction">
            <SelectValue>{() => label}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-80 w-max min-w-44">
            <SelectItem value="all" className="whitespace-nowrap">Every jurisdiction</SelectItem>
            <SelectItem value="all-states" className="whitespace-nowrap">Every state</SelectItem>
            {JURISDICTIONS.map((j) => (
              <SelectItem key={j.value} value={j.value} className="whitespace-nowrap">
                {j.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(v) => v && setKind(v as "bill" | "statute")}>
          <SelectTrigger className="h-8 w-32" size="sm" aria-label="Kind">
            <SelectValue>{() => (kind === "bill" ? "Bills" : "Statutes")}</SelectValue>
          </SelectTrigger>
          <SelectContent className="w-max min-w-44">
            <SelectItem value="bill" className="whitespace-nowrap">Bills</SelectItem>
            <SelectItem value="statute" className="whitespace-nowrap">Statutes</SelectItem>
          </SelectContent>
        </Select>
        <Input className="h-8 w-56" placeholder={kind === "bill" ? "Sessions: 2025, 2023 (all when empty)" : "Laws: PEN, AGM (all when empty)"} value={units} onChange={(e) => setUnits(e.target.value)} />
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <Checkbox checked={now} onCheckedChange={(v) => setNow(v === true)} />
          Front of the queue
        </label>
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <Checkbox checked={again} onCheckedChange={(v) => setAgain(v === true)} />
          Again, if built
        </label>
        <Button size="sm" className="gap-1" onClick={run} disabled={busy}>
          <PlayIcon className="size-3.5" />
          Queue
        </Button>
        {result && <span className="text-sm text-muted-foreground">{result}</span>}
      </CardContent>
    </Card>
  )
}

function JobTable({ jobs, onChange, actions = false }: { jobs?: JobLine[]; onChange: () => void; actions?: boolean }) {
  const act = async (id: number, action: "retry" | "cancel" | "front") => {
    await send("PATCH", { ids: [id], action })
    onChange()
  }
  if (!jobs) return <Skeleton className="mt-3 h-24 w-full" />
  if (!jobs.length) return <p className="py-6 text-center text-sm text-muted-foreground">None.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/60">
          <TableHead>Jurisdiction</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-48">Progress</TableHead>
          <TableHead className="text-right">Fell Out</TableHead>
          <TableHead className="text-right">Coverage</TableHead>
          <TableHead>Updated</TableHead>
          {actions && <TableHead className="w-24 text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => {
          const done = job.built + job.unchanged
          const share = job.total ? Math.min(1, done / job.total) : job.status === "done" ? 1 : 0
          return (
            <TableRow key={job.id}>
              <TableCell className="whitespace-nowrap">{stateName(jurisOf(job.jurisdiction))}</TableCell>
              <TableCell>{job.kind === "bill" ? "Bills" : "Statutes"}</TableCell>
              <TableCell className="whitespace-nowrap">{unitLabel(job)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("h-5 capitalize", STATUS_TONE[job.status])} title={job.reason ?? job.error ?? undefined}>
                  {job.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
                  </div>
                  <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{job.total ? `${done.toLocaleString()} / ${job.total.toLocaleString()}` : done ? done.toLocaleString() : ""}</span>
                </div>
                {(job.reason || job.error) && <p className="mt-1 max-w-72 truncate text-xs text-muted-foreground">{job.reason ?? job.error}</p>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{job.fell_out.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{pct(job.coverage)}</TableCell>
              <TableCell className="whitespace-nowrap">{fmtWhen(job.heartbeat_at ?? job.finished_at ?? job.created_at)}</TableCell>
              {actions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {["failed", "blocked", "waiting", "cancelled"].includes(job.status) && (
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => act(job.id, "retry")} aria-label="Retry">
                        <RotateCcwIcon className="size-3.5" />
                      </Button>
                    )}
                    {["queued", "waiting"].includes(job.status) && (
                      <>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => act(job.id, "front")} aria-label="Front of the queue">
                          <ArrowUpToLineIcon className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => act(job.id, "cancel")} aria-label="Cancel">
                          <XIcon className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

/** A tile per jurisdiction: its flag, what is stored, and where its jobs stand. */
function QueueGrid({ status }: { status?: Status }) {
  if (!status) return <Skeleton className="mt-3 h-40 w-full" />
  const by = new Map<string, { stored: number; statuses: Record<string, number> }>()
  for (const line of status.store) {
    const e = by.get(line.jurisdiction) ?? { stored: 0, statuses: {} }
    e.stored += line.expressions
    by.set(line.jurisdiction, e)
  }
  for (const q of status.queue) {
    const e = by.get(q.jurisdiction) ?? { stored: 0, statuses: {} }
    e.statuses[q.status] = (e.statuses[q.status] ?? 0) + q.jobs
    by.set(q.jurisdiction, e)
  }
  const order = ["running", "queued", "waiting", "failed", "blocked", "done"]
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
      {JURISDICTIONS.filter((j) => by.has(j.value)).map((j) => {
        const e = by.get(j.value)!
        const dot = e.statuses.running ? "bg-blue-500 animate-pulse" : e.statuses.failed ? "bg-red-500" : e.statuses.queued || e.statuses.waiting ? "bg-amber-500" : "bg-green-500"
        return (
          <div key={j.value} className="flex h-[132px] flex-col justify-between rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between">
              <FlagChip state={j.code} width={36} />
              <span className={cn("mt-1 size-2.5 rounded-full", dot)} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{j.label}</p>
              <p className="truncate text-xs text-muted-foreground tabular-nums">{`${fmtCompact(e.stored, false)} expressions`}</p>
              <p className="truncate text-xs text-muted-foreground">
                {order
                  .filter((k) => e.statuses[k])
                  .map((k) => `${e.statuses[k]} ${k}`)
                  .join(" · ")}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
