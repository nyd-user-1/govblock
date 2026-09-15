"use client"

import * as React from "react"
import { CheckCircle2Icon, CircleAlertIcon, PlayIcon, RefreshCwIcon, ServerIcon } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { StatDatabaseGrid, type DbStat } from "@/components/admin/blocks/stats"
import { cutLink } from "@/components/clips/store"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// Clips (Brendan, 2026-09-14: "a dashboard for this the same way we created
// a dashboard for database, and pipeline, and committees"): the Data
// Pipeline's shape turned to clips. Six tiles; clips a day by how they were
// made; the queue of pasted links, each with where it stands and a Run for
// one still waiting; then the caption reader, the worker box, and the reports
// still open.

type Totals = Record<"clips" | "public" | "recorded" | "cut" | "generated" | "removed" | "week" | "links" | "queued" | "running" | "done" | "failed" | "templates", number>
type Day = { day: string; recorded: number; cut: number; generated: number }
type Cut = { id: string; title: string | null; source_url: string | null; video_id: string | null; status: string; clips: number | null; error: string | null; reader: string | null; created_at: string; started_at: string | null; finished_at: string | null; transcript: string | null }
type Report = { id: string; clip_id: string; title: string | null; reason: string; details: string; created_at: string }
type Data = { totals: Totals; days: Day[]; queue: Cut[]; reports: Report[]; transcripts: { count: number; supadata: number; youtube: number; worker: number; hours: number }; captions: "supadata" | "youtube" }

const chart = {
  recorded: { label: "Recorded", color: "var(--chart-1)" },
  cut: { label: "Cut", color: "var(--chart-2)" },
  generated: { label: "Generated", color: "var(--chart-3)" },
} satisfies ChartConfig

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—")
const took = (a: string | null, b: string | null) => (a && b ? `${Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000))} s` : "—")

const TONE: Record<string, string> = { queued: "text-amber-600", running: "text-blue-600", done: "text-green-600", failed: "text-destructive", review: "text-muted-foreground" }

export function ClipsPage() {
  const [data, setData] = React.useState<Data | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const res = await fetch("/api/clips/admin", { cache: "no-store" }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as (Data & { error?: string }) | null
    if (!res?.ok || !body || body.error) return setError(body?.error ?? "The figures did not load.")
    setError(null)
    setData(body)
  }, [])
  React.useEffect(() => {
    void load()
  }, [load])

  const run = async (id: string) => {
    setRunning(id)
    try {
      for (let i = 0; i < 12; i++) {
        const { upload } = await cutLink(id)
        if (upload.status !== "running") break
      }
    } catch {
      // The row shows what happened once the figures are read again.
    }
    setRunning(null)
    void load()
  }

  const t = data?.totals
  const stats: DbStat[] = [
    { title: "Clips", value: t ? t.clips.toLocaleString() : "…", note: t ? `${t.week} this week` : undefined, direction: "neutral" },
    { title: "On the feed", value: t ? t.public.toLocaleString() : "…", note: t ? `${t.removed} taken down` : undefined, direction: "neutral" },
    { title: "Links pasted", value: t ? t.links.toLocaleString() : "…", note: t ? `${t.queued} waiting · ${t.failed} failed` : undefined, direction: "neutral" },
    { title: "Cut clips", value: t ? t.cut.toLocaleString() : "…", note: t ? `from ${t.done} links` : undefined, direction: "neutral" },
    { title: "Transcripts", value: data ? data.transcripts.count.toLocaleString() : "…", note: data ? `${data.transcripts.hours} hours of video` : undefined, direction: "neutral" },
    { title: "Templates", value: t ? t.templates.toLocaleString() : "…", note: t ? `${t.generated} generated clips` : undefined, direction: "neutral" },
  ]
  const refresh = (
    <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={() => void load()}>
      <RefreshCwIcon />
    </Button>
  )
  const waiting = data?.queue.filter((c) => c.status === "queued" && !c.video_id).length ?? 0

  return (
    <div>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <StatDatabaseGrid stats={stats} />

      <div className="mt-4 sm:mt-5">
        <Card className="gap-4">
          <CardHeader>
            <CardAnchor>Clips a day</CardAnchor>
            <CardAction>
              <CardTools>{refresh}</CardTools>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data ? (
              <ChartContainer config={chart} className="aspect-auto h-56 w-full">
                <AreaChart data={data.days} margin={{ left: 0, right: 0, top: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v: string) => new Date(`${v}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  {(["generated", "cut", "recorded"] as const).map((k) => (
                    <Area key={k} dataKey={k} type="monotone" stackId="a" stroke={`var(--color-${k})`} fill={`var(--color-${k})`} fillOpacity={0.25} />
                  ))}
                </AreaChart>
              </ChartContainer>
            ) : (
              <Skeleton className="h-56 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 sm:mt-5">
        <Card className="gap-4">
          <CardHeader className="max-md:px-4">
            <CardAnchor>Queue</CardAnchor>
            <CardAction>
              <CardTools>{refresh}</CardTools>
            </CardAction>
          </CardHeader>
          <CardContent className="max-md:px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Video</TableHead>
                  <TableHead>Reader</TableHead>
                  <TableHead>Pasted</TableHead>
                  <TableHead>Took</TableHead>
                  <TableHead>Captions</TableHead>
                  <TableHead>Clips</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data
                  ? Array.from({ length: 5 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : data.queue.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="max-w-96">
                          <div className="flex min-w-0 flex-col">
                            {c.video_id ? (
                              <a href={`/clips/transcript?v=${c.video_id}`} className="truncate font-medium">
                                {c.title ?? c.video_id}
                              </a>
                            ) : (
                              <span className="truncate font-medium">{c.title ?? c.source_url}</span>
                            )}
                            {c.error && <span className="truncate text-xs text-muted-foreground" title={c.error}>{c.error}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{c.reader ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{when(c.created_at)}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{took(c.started_at, c.finished_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">{c.transcript ?? (c.video_id ? "—" : "worker box")}</TableCell>
                        <TableCell className="tabular-nums">{c.clips ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("h-5", TONE[c.status])}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.video_id && (c.status === "queued" || c.status === "running") && (
                            <Button variant="ghost" size="icon-sm" aria-label="Run" disabled={running === c.id} onClick={() => void run(c.id)}>
                              <PlayIcon className={cn(running === c.id && "animate-pulse")} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                {data && data.queue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No links pasted yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-3">
        <Card className="gap-3">
          <CardHeader>
            <CardAnchor>Captions</CardAnchor>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {data ? (
              <>
                <div className={cn("rounded-lg border p-3", data.captions === "supadata" ? "border-green-600/20 bg-green-600/5" : "border-amber-500/30 bg-amber-500/5")}>
                  <p className={cn("flex items-center gap-1.5 text-xs font-medium", data.captions === "supadata" ? "text-green-700" : "text-amber-700")}>
                    {data.captions === "supadata" ? <CheckCircle2Icon className="size-3.5" /> : <CircleAlertIcon className="size-3.5" />}
                    {data.captions === "supadata" ? "Supadata" : "YouTube, direct"}
                  </p>
                  <p className="mt-1 text-muted-foreground">{data.captions === "supadata" ? "Reads captions from any server." : "YouTube refuses AWS addresses; set SUPADATA_API_KEY for the deployed site."}</p>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {(["supadata", "youtube", "worker"] as const).map((k) => (
                    <div key={k} className="rounded-lg bg-muted/50 p-2">
                      <dt className="text-xs text-muted-foreground capitalize">{k}</dt>
                      <dd className="text-lg font-semibold tabular-nums">{data.transcripts[k]}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <Skeleton className="h-28 w-full" />
            )}
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardAnchor>Worker box</CardAnchor>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-start gap-3">
              <ServerIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="font-medium">govblock-xml</p>
                <p className="text-muted-foreground">c7g.4xlarge · i-09c2fbf8624d91bdf · started by hand</p>
              </div>
            </div>
            <p className="text-muted-foreground">Cuts what the site cannot: links other than YouTube, videos without captions, and vertical renders.</p>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Waiting for it</p>
              <p className="text-lg font-semibold tabular-nums">{data ? waiting : "…"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardAnchor>Reports</CardAnchor>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {!data ? (
              <Skeleton className="h-28 w-full" />
            ) : data.reports.length === 0 ? (
              <p className="text-muted-foreground">None open.</p>
            ) : (
              data.reports.map((r) => (
                <a key={r.id} href={`/clips?c=${encodeURIComponent(r.clip_id)}`} className="flex flex-col rounded-lg px-2 py-1.5 no-underline hover:bg-muted">
                  <span className="truncate font-medium">{r.title ?? r.clip_id}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.reason} · {when(r.created_at)}
                    {r.details ? ` · ${r.details}` : ""}
                  </span>
                </a>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
