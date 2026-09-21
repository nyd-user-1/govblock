"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ChevronDown, GripVertical, MoreHorizontal, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { Area, AreaChart, CartesianGrid, YAxis } from "recharts"

import { doorHref, entitled } from "@/lib/entitlements"
import { CONGRESS, stateName } from "@/lib/filters"
import { fmtDate, fmtNumber } from "@/lib/format"
import type { MetricKey, MetricSeries } from "@/lib/policy/metrics"
import type { SessionRow } from "@/lib/policy/types"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { LiveFetch } from "@/lib/policy/manual-fetch"
import { usePolicy } from "@/lib/policy/use-policy"
import { FlagChip } from "@/components/policy/imagery"
import { StatePicker } from "@/components/state-switcher"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/chart"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@govblock/ui/components/nova/popover"

// Cloudflare's account-home analytics, adapted (Brendan, 2026-09-07): a
// four-column grid of tiles, each one metric over a window — the number,
// the change against the window before, the days as a line. A tile's corner
// drags it to two columns wide and back, as hq's grid resizes (pointer
// events, no library); the grip beside its menu drags it to another tile's
// place (Brendan, 2026-09-21); its menu refreshes or removes it; the + opens
// Cloudflare's "Add metric" panel (Brendan, 2026-09-07), the metrics not yet
// on the grid one to a row; the empty slots in the last row are + too. The
// layout and the window live in the browser.
//
// Two buttons lead the head (Brendan, 2026-09-21): the sessions, and the
// jurisdiction, which opens on U.S. Congress and is the grid's own, not the
// header's flag. The first lists the jurisdiction's sessions, newest first and
// open on the current one — a session's own span rather than a run of days —
// and, under a rule, the runs of days, which count within the current
// session. An earlier session is a plan's, as it is everywhere else: the pick
// leads to the door rather than to a grid of refusals.

const COLUMNS = 4
const KEY = "govblock:home-tiles"

export type Tile = { id: string; metric: MetricKey; span: 1 | 2 }

const METRICS: { key: MetricKey; label: string; description: string }[] = [
  { key: "votes", label: "Total Votes", description: "Roll calls taken" },
  { key: "introduced", label: "Bills Introduced", description: "Bills introduced or prefiled" },
  { key: "engrossed", label: "Bills Engrossed", description: "Bills passed by one chamber" },
  { key: "passed", label: "Bills Passed", description: "Bills enacted, signed or chaptered" },
  { key: "vetoed", label: "Bills Vetoed", description: "Vetoes recorded" },
  { key: "hearings-scheduled", label: "Hearings Scheduled", description: "Hearings on the calendar ahead" },
  { key: "hearings-held", label: "Hearings Held", description: "Hearings the calendar shows held" },
  { key: "actions", label: "Actions", description: "Every action on every bill" },
  { key: "amendments", label: "Amendments", description: "Amendments offered, Congress only" },
]

const DEFAULT: Tile[] = [
  { id: "t1", metric: "votes", span: 2 },
  { id: "t2", metric: "vetoed", span: 2 },
  { id: "t3", metric: "introduced", span: 1 },
  { id: "t4", metric: "engrossed", span: 1 },
  { id: "t5", metric: "passed", span: 1 },
  { id: "t6", metric: "hearings-scheduled", span: 1 },
  { id: "t7", metric: "hearings-held", span: 1 },
]

type Days = number | "session"

const RANGES: { days: Days; label: string }[] = [
  { days: "session", label: "Session" },
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
]

/** `session` is null for the jurisdiction's current one, which the API resolves; a number is an earlier one, and its window is always the session. */
type Saved = { tiles: Tile[]; days: Days; state: string; session: number | null }

const FRESH: Saved = { tiles: DEFAULT, days: "session", state: CONGRESS, session: null }

function load(): Saved {
  if (typeof window === "undefined") return FRESH
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return FRESH
    const saved = JSON.parse(raw) as Partial<Saved>
    const tiles = Array.isArray(saved.tiles) ? saved.tiles.filter((t) => t && METRICS.some((m) => m.key === t.metric)) : DEFAULT
    // A layout saved before the grid had a jurisdiction of its own keeps its tiles and takes the new defaults for the rest.
    if (typeof saved.state !== "string") return { ...FRESH, tiles: tiles.length ? tiles : DEFAULT }
    const session = typeof saved.session === "number" ? saved.session : null
    return { tiles: tiles.length ? tiles : DEFAULT, days: session == null && RANGES.some((r) => r.days === saved.days) ? (saved.days as Days) : "session", state: saved.state, session }
  } catch {
    return FRESH
  }
}

function save(saved: Saved) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // The layout is a convenience; losing it costs a default grid.
  }
}

const chartConfig = { value: { label: "Count", color: "var(--chart-1)" } } satisfies ChartConfig

/** One tile: the metric over the window. */
function MetricTile({ tile, state, session, days, nonce, columnWidth, dragging, onSpan, onRemove, onRefresh, onDragStart, onDragEnter, onDragEnd }: { tile: Tile; /** The grid's jurisdiction. */ state: string; /** An earlier session; null is the current one, which the API resolves. */ session: number | null; days: Days; nonce: number; columnWidth: number; /** This tile is the one in the air. */ dragging: boolean; onSpan: (span: 1 | 2) => void; onRemove: () => void; onRefresh: () => void; onDragStart: () => void; onDragEnter: () => void; onDragEnd: () => void }) {
  const { data, isLoading } = usePolicy<MetricSeries>("metric", { state, session: session == null ? undefined : String(session) }, { metric: tile.metric, days, nonce })
  const meta = METRICS.find((m) => m.key === tile.metric)
  const total = data?.total ?? 0
  const previous = data?.previous ?? 0
  // A session has no window before it, so no change to show.
  const change = data?.previous == null ? null : previous > 0 ? ((total - previous) / previous) * 100 : total > 0 ? 100 : null
  const empty = !isLoading && data != null && total === 0
  const [resizing, setResizing] = React.useState(false)
  // The grip makes the tile draggable for as long as it is held, as the
  // workspace grid's does (components/workspace/grid.tsx): `draggable` has to
  // be true before the drag starts, which is what pressing the grip sets.
  const [byHandle, setByHandle] = React.useState(false)

  // The corner drag: the pointer's travel, against the column, decides the span.
  const onHandle = (event: React.PointerEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startSpan = tile.span
    setResizing(true)
    const move = (e: PointerEvent) => {
      if (!columnWidth) return
      const next = Math.max(1, Math.min(2, Math.round(startSpan + (e.clientX - startX) / columnWidth))) as 1 | 2
      if (next !== tile.span) onSpan(next)
    }
    const up = () => {
      setResizing(false)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <div
      className={cn("relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-xs", resizing && "ring-2 ring-ring/40", dragging && "opacity-40", tile.span === 2 ? "col-span-2" : "col-span-1")}
      data-span={tile.span}
      draggable={byHandle}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", tile.id)
        onDragStart()
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      onDragEnd={() => {
        setByHandle(false)
        onDragEnd()
      }}
    >
      <div className="flex items-start gap-3 px-4 pt-3 pb-0.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-muted-foreground" title={meta?.description}>
            {meta?.label ?? tile.metric}
          </div>
        </div>
        <span
          aria-hidden
          title="Drag to move"
          onPointerDown={() => setByHandle(true)}
          onPointerUp={() => setByHandle(false)}
          className="-mt-1 -mr-3 flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing [&_svg]:size-4"
        >
          <GripVertical />
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-7 text-muted-foreground" aria-label="Tile menu">
                <MoreHorizontal />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-max min-w-44">
            <DropdownMenuItem className="whitespace-nowrap" onClick={onRefresh}>
              <RefreshCw /> Refresh
            </DropdownMenuItem>
            <DropdownMenuItem className="whitespace-nowrap" onClick={() => onSpan(tile.span === 2 ? 1 : 2)}>
              <ChevronDown className="-rotate-90" /> {tile.span === 2 ? "One column" : "Two columns"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="whitespace-nowrap" onClick={onRemove}>
              <Trash2 /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-0.5 pb-3">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-2xl leading-tight font-semibold", isLoading && "animate-pulse rounded bg-muted text-transparent")}>{fmtNumber(total)}</span>
          {change != null && !isLoading && (
            <span className={cn("text-sm font-medium tabular-nums", change >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
              {change >= 0 ? "↗" : "↘"} {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="relative mt-2 min-h-0 flex-1">
          {empty ? (
            <NoData />
          ) : (
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart accessibilityLayer data={data?.series ?? []} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id={`fill-${tile.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="0" />
                <YAxis orientation="right" axisLine={false} tickLine={false} width={34} tickCount={4} allowDecimals={false} tick={{ fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(value) => fmtDate(String(value))} labelKey="date" />} />
                <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={1.5} fill={`url(#fill-${tile.id})`} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </div>
      {/* The corner: drag it right to widen the tile to two columns, left to bring it back. */}
      <button
        type="button"
        aria-label={tile.span === 2 ? "Drag to narrow" : "Drag to widen"}
        title="Drag to resize"
        onPointerDown={onHandle}
        className="absolute right-1 bottom-1 size-4 cursor-nwse-resize text-muted-foreground/60 hover:text-foreground"
      >
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
          <path d="M14 2 2 14M14 8l-6 6M14 14h0" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </button>
    </div>
  )
}

/** One metric tile by itself, for /workspace/blocks: the number, the change, the days as a line — no menu, no corner. */
export function MetricCard({ metric, days = 30 }: { metric: MetricKey; days?: number }) {
  const { state, session, resolved } = useJurisdiction()
  const { data, isLoading } = usePolicy<MetricSeries>(resolved ? "metric" : null, { state, session: session ? String(session) : undefined }, { metric, days })
  const meta = METRICS.find((m) => m.key === metric)
  const total = data?.total ?? 0
  const previous = data?.previous ?? 0
  const change = previous > 0 ? ((total - previous) / previous) * 100 : total > 0 ? 100 : null
  const empty = !isLoading && data != null && total === 0
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="px-4 pt-3 pb-0.5 text-xs font-medium text-muted-foreground" title={meta?.description}>
        {meta?.label ?? metric}
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-0.5 pb-3">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-2xl leading-tight font-semibold", isLoading && "animate-pulse rounded bg-muted text-transparent")}>{fmtNumber(total)}</span>
          {change != null && !isLoading && (
            <span className={cn("text-sm font-medium tabular-nums", change >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
              {change >= 0 ? "↗" : "↘"} {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="relative mt-2 min-h-0 flex-1">
          {empty ? (
            <NoData />
          ) : (
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart accessibilityLayer data={data?.series ?? []} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id={`fill-card-${metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="0" />
                <YAxis orientation="right" axisLine={false} tickLine={false} width={34} tickCount={4} allowDecimals={false} tick={{ fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(value) => fmtDate(String(value))} labelKey="date" />} />
                <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={1.5} fill={`url(#fill-card-${metric})`} isAnimationActive={false} />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </div>
    </div>
  )
}

export const METRIC_CARDS = METRICS

/** Cloudflare's "Add metric": a titled panel off the +, closed by its X or by a choice. */
function AddMetric({ trigger, align, unused, onAdd }: { trigger: React.ReactElement; align: "start" | "end"; unused: typeof METRICS; onAdd: (metric: MetricKey) => void }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align={align} className="w-64 gap-0 rounded-xl p-0">
        <div className="flex items-center justify-between py-1.5 pr-1.5 pl-3">
          <span className="text-xs font-medium text-muted-foreground">Add metric</span>
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Close" onClick={() => setOpen(false)}>
            <X />
          </Button>
        </div>
        <ul className="m-0 min-h-56 list-none divide-y border-t p-0">
          {unused.length ? (
            unused.map((m) => (
              <li key={m.key} className="m-0 p-0">
                <button
                  type="button"
                  title={m.description}
                  className="flex w-full items-center px-3 py-2.5 text-left text-sm whitespace-nowrap transition-colors hover:bg-muted"
                  onClick={() => {
                    onAdd(m.key)
                    setOpen(false)
                  }}
                >
                  {m.label}
                </button>
              </li>
            ))
          ) : (
            <li className="m-0 px-3 py-2.5 text-sm text-muted-foreground">Every metric is on the grid</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** Cloudflare's empty tile: a faint wave with "No data" over it. */
function NoData() {
  return (
    <div className="relative flex h-full items-center justify-center">
      <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="absolute inset-x-0 top-1/2 h-16 w-full -translate-y-1/2 text-border" aria-hidden>
        <path d="M0 40 C 30 20, 60 60, 90 40 S 150 20, 180 40 S 240 60, 270 40 S 330 20, 360 40 S 400 55, 400 45" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <span className="relative rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">No data</span>
    </div>
  )
}

/** The grid reads as the page opens, whatever gate the page is under — its tiles and its list of sessions alike. */
export function AnalyticsGrid() {
  return (
    <LiveFetch>
      <Grid />
    </LiveFetch>
  )
}

function Grid() {
  const [saved, setSaved] = React.useState<Saved>(FRESH)
  const router = useRouter()
  const { reader } = useJurisdiction()
  const [picking, setPicking] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [nonce, setNonce] = React.useState(0)
  const grid = React.useRef<HTMLDivElement>(null)
  const [columnWidth, setColumnWidth] = React.useState(0)
  const [dragging, setDragging] = React.useState<string | null>(null)

  React.useEffect(() => {
    setSaved(load())
    setReady(true)
  }, [])
  React.useEffect(() => {
    if (ready) save(saved)
  }, [saved, ready])
  React.useEffect(() => {
    const el = grid.current
    if (!el) return
    const measure = () => setColumnWidth(el.getBoundingClientRect().width / COLUMNS)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { tiles, days, state, session } = saved
  const { data: sessionRows } = usePolicy<SessionRow[]>("sessions", { state })
  const sessions = Array.isArray(sessionRows) ? sessionRows : []
  // The current session is the newest with bills on file, as the header's scope picks it.
  const current = (sessions.find((row) => Number(row.bills) > 0) ?? sessions[0])?.session_id ?? null
  const sessionTitle = (id: number | null) => sessions.find((row) => Number(row.session_id) === Number(id))?.title ?? (id == null ? "Session" : `${id} Session`)
  const pickSession = (id: number) => {
    if (current != null && Number(id) === Number(current)) return update({ session: null, days: "session" })
    const allowed = entitled(reader, { state, session: id, current, entity: "bills" })
    if (allowed !== "open") return router.push(doorHref(allowed))
    update({ session: id, days: "session" })
  }
  // Congress, and the home state once there is one: what the header's switcher calls Active.
  const active = reader.home && reader.home !== CONGRESS ? [CONGRESS, reader.home] : [CONGRESS]
  // The header's rule (lib/policy/jurisdiction.tsx): a jurisdiction the reader may not open leads to sign-in or the plan, not to a grid of refusals.
  const pick = (code: string) => {
    setPicking(false)
    const allowed = entitled(reader, { state: code })
    if (allowed !== "open") return router.push(doorHref(allowed))
    update({ state: code, session: null })
  }
  const update = (next: Partial<Saved>) => setSaved((current) => ({ ...current, ...next }))
  const setTile = (id: string, patch: Partial<Tile>) => update({ tiles: tiles.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  const remove = (id: string) => update({ tiles: tiles.filter((t) => t.id !== id) })
  // The tile in the air takes the place of the tile it is dragged onto; the order is the saved layout's.
  const moveTo = (id: string, onto: string) => {
    const from = tiles.findIndex((t) => t.id === id)
    const to = tiles.findIndex((t) => t.id === onto)
    if (from < 0 || to < 0 || from === to) return
    const next = [...tiles]
    next.splice(to, 0, ...next.splice(from, 1))
    update({ tiles: next })
  }
  const add = (metric: MetricKey) => update({ tiles: [...tiles, { id: `t${Date.now().toString(36)}`, metric, span: 1 }] })
  const unused = METRICS.filter((m) => !tiles.some((t) => t.metric === m.key))
  // The empty slots that finish the last row, each a + (Cloudflare's dashed tiles).
  const used = tiles.reduce((sum, t) => sum + t.span, 0) % COLUMNS
  const blanks = used === 0 ? 0 : COLUMNS - used
  const windows = RANGES.filter((r) => r.days !== "session")
  const label = days === "session" ? sessionTitle(session ?? current) : (windows.find((r) => r.days === days)?.label ?? sessionTitle(current))
  const chosen = days === "session" ? `s:${session ?? current ?? ""}` : `d:${days}`

  return (
    <section id="analytics" className="scroll-mt-24">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Analytics</h2>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline">
                  <CalendarDays /> {label}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="max-h-96 w-max min-w-44 overflow-y-auto">
              <DropdownMenuRadioGroup value={chosen} onValueChange={(value) => (value.startsWith("s:") ? pickSession(Number(value.slice(2))) : update({ session: null, days: Number(value.slice(2)) }))}>
                {sessions.map((row) => (
                  <DropdownMenuRadioItem key={row.session_id} value={`s:${row.session_id}`} className="whitespace-nowrap">
                    {row.title ?? `${row.session_id} Session`}
                  </DropdownMenuRadioItem>
                ))}
                {sessions.length > 0 && <DropdownMenuSeparator />}
                {windows.map((r) => (
                  <DropdownMenuRadioItem key={r.days} value={`d:${r.days}`} className="whitespace-nowrap">
                    {r.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover open={picking} onOpenChange={setPicking}>
            <PopoverTrigger
              render={
                <Button variant="outline" aria-label={`Jurisdiction: ${stateName(state)}. Change jurisdiction`}>
                  <FlagChip state={state} /> {state === CONGRESS ? "U.S. Congress" : stateName(state)}
                </Button>
              }
            />
            <PopoverContent align="end" className="w-64 p-0" aria-label="Jurisdictions">
              <StatePicker state={state} active={active} onSelect={pick} className="rounded-lg!" />
            </PopoverContent>
          </Popover>
          <AddMetric
            align="end"
            unused={unused}
            onAdd={add}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Add a tile">
                <Plus />
              </Button>
            }
          />
          <Button variant="ghost" size="icon" aria-label="Refresh" onClick={() => setNonce((n) => n + 1)}>
            <RefreshCw />
          </Button>
        </div>
      </div>
      <div ref={grid} className="grid auto-rows-[224px] grid-cols-4 gap-4">
        {/* A refresh, the header's or a tile's, is a new nonce. */}
        <>
          {ready &&
            tiles.map((tile) => (
              <MetricTile
                key={tile.id}
                tile={tile}
                state={state}
                session={session}
                days={days}
                nonce={nonce}
                columnWidth={columnWidth}
                dragging={dragging === tile.id}
                onSpan={(span) => setTile(tile.id, { span })}
                onRemove={() => remove(tile.id)}
                onRefresh={() => setNonce((n) => n + 1)}
                onDragStart={() => setDragging(tile.id)}
                onDragEnter={() => dragging && dragging !== tile.id && moveTo(dragging, tile.id)}
                onDragEnd={() => setDragging(null)}
              />
            ))}
        </>
        {ready &&
          Array.from({ length: blanks }, (_, i) => (
            <AddMetric
              key={`blank-${i}`}
              align="start"
              unused={unused}
              onAdd={add}
              trigger={
                <button type="button" aria-label="Add a tile" className="flex h-full w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground">
                  <Plus className="size-6" />
                </button>
              }
            />
          ))}
      </div>
    </section>
  )
}
