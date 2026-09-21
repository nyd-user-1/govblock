"use client"

import * as React from "react"
import { CheckIcon, Loader2, XIcon } from "lucide-react"

import { stateName } from "@/lib/filters"
import { isOver, type PipelineRun } from "@/lib/pipeline/use-pipeline"
import { FlagChip } from "@/components/policy/imagery"
import { WavePhysicsLoader } from "@/components/wave-physics-loader"
import { cn } from "@govblock/ui/lib/utils"

// A run from zero to running, each stop along the way (Brendan, 2026-09-20).
// The first two stops are EC2's word — the instance asked for, then up; every
// one after it is reported by the box itself as it happens (scripts/pipeline/
// launch.mjs writes them to S3), so the meter is where the box is, not a guess
// at it. A single state shows its stops, the time each took, and the tail of
// its log; a fleet shows one line a box.

const STOPS = [
  { key: "requested", label: "Requested", note: "the instance is asked for" },
  { key: "running", label: "Instance up", note: "EC2 reports it running" },
  { key: "aws", label: "Can report", note: "the AWS CLI is on the box" },
  { key: "tools", label: "Text tools", note: "poppler, antiword, git" },
  { key: "node", label: "Node 22", note: "the loader's runtime" },
  { key: "loader", label: "Loader unpacked", note: "livingston, from the fleet's bundle" },
  { key: "code", label: "Today's code", note: "the laptop's livingston over the bundle's" },
  { key: "db", label: "Database confirmed", note: "Aurora, or the run ends here" },
  { key: "discovering", label: "Discovering", note: "new bills and documents, from the index" },
  { key: "fetching", label: "Fetching", note: "the loader is running" },
  { key: "publishing", label: "Publishing", note: "the changelog's views rebuilt" },
  { key: "done", label: "Finished", note: "log saved, instance ended" },
] as const

/** How far a run has come, 1 to STOPS.length; its exit code once it has one; and how its discovery ended. */
export function progressOf(run: PipelineRun): { at: number; exit: number | null; times: (string | null)[]; db: string | null; found: number | null } {
  const times: (string | null)[] = STOPS.map(() => null)
  times[0] = run.launched
  let at = 1
  if (run.status !== "pending") at = 2
  let exit: number | null = null
  let db: string | null = null
  let found: number | null = null
  for (const s of run.stages) {
    if (s.stage.startsWith("discovered:")) found = Number(s.stage.split(":")[1] ?? 0)
    const key = s.stage.split(":")[0] === "refused" ? "db" : s.stage.split(":")[0]
    if (key === "db") db = s.stage.slice(s.stage.indexOf(":") + 1) || null
    const i = STOPS.findIndex((stop) => stop.key === key)
    if (i < 0) continue
    times[i] = s.at
    at = Math.max(at, i + 1)
    if (key === "done") exit = Number(s.stage.split(":")[1] ?? 0)
  }
  // A box that ended without saying so stopped where it was; the meter does not claim the rest.
  return { at, exit, times, db, found }
}

/** The loader says how far it is in its own log: "offset 5000/25497", "12/47 states done". The newest such line wins. */
function fetched(log: string[]): { done: number; of: number } | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const m = /offset (\d+)\/(\d+)/.exec(log[i]) ?? /(\d+)\/(\d+) states done/.exec(log[i])
    if (m && Number(m[2]) > 0) return { done: Number(m[1]), of: Number(m[2]) }
  }
  return null
}

/** The sweep counts the sessions it imports: "plan: … 3 to import", then "[2/3] MT 2159 …". */
function swept(log: string[]): { done: number; of: number } | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const m = /\[(\d+)\/(\d+)\] [A-Z]{2} /.exec(log[i])
    if (m) return { done: Number(m[1]), of: Number(m[2]) }
    const plan = /· (\d+) to import/.exec(log[i])
    if (plan) return { done: 0, of: Number(plan[1]) }
  }
  return null
}

/** Stops the box reports as they START, so their time runs to the next stop; every other is reported as it ends. */
const OPENING = new Set(["discovering", "fetching", "publishing"])

/** Now, once a second, while something is running: the meter's clock moves between the board's looks at the box. */
function useNow(on: boolean) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!on) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [on])
  return now
}

const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "")
const took = (from: string | null, to: string | null) => {
  if (!from || !to) return ""
  const s = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000))
  return s < 90 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function Meter({ run }: { run: PipelineRun }) {
  const { at, exit, times, db, found } = progressOf(run)
  const over = isOver(run)
  const now = useNow(!over)
  const progress = fetched(run.log)
  const sessions = swept(run.log)
  const since = (iso: string | null) => {
    if (!iso) return ""
    const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
    return s < 90 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  }
  const failed = (exit !== null && exit !== 0) || (over && exit === null)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        {run.state ? <FlagChip state={run.state} width={28} /> : null}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{run.state ? stateName(run.state) : run.name}</span>
        <span className={cn("text-xs tabular-nums", failed ? "text-destructive" : "text-muted-foreground")}>{failed ? (exit === null ? "ended early" : `exit ${exit}`) : `${Math.round((at / STOPS.length) * 100)}%`}</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={STOPS.length} aria-valuenow={at} className="flex gap-1">
        {STOPS.map((stop, i) => (
          <span key={stop.key} className={cn("h-1.5 flex-1 rounded-full transition-colors", i < at ? (failed ? "bg-destructive" : i === STOPS.length - 1 ? "bg-emerald-500" : "bg-blue-500") : "bg-muted", i === at - 1 && !over && "animate-pulse")} />
        ))}
      </div>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
        {STOPS.map((stop, i) => {
          const done = i < at - 1 || (i === at - 1 && (over || stop.key === "done"))
          const current = i === at - 1 && !done
          return (
            <li key={stop.key} className={cn("flex items-center gap-2.5", i >= at && "text-muted-foreground/60")}>
              <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border [&_svg]:size-2.5", done && "border-transparent bg-blue-500 text-white", current && "border-blue-500 text-blue-500", failed && i === at - 1 && "border-transparent bg-destructive text-white")}>
                {failed && i === at - 1 ? <XIcon /> : done ? <CheckIcon /> : current ? <Loader2 className="animate-spin" /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {stop.label}
                <span className="ml-2 text-xs text-muted-foreground">{stop.key === "db" && db ? db : stop.key === "discovering" && found !== null && found !== 0 ? `ended with exit ${found}; fetching what was already outstanding` : stop.key === "discovering" && sessions && i <= at - 1 ? (sessions.of ? `${sessions.done} of ${sessions.of} session${sessions.of === 1 ? "" : "s"} imported` : "nothing has moved since the last look") : stop.key === "fetching" && progress && i <= at - 1 ? `${progress.done.toLocaleString()} of ${progress.of.toLocaleString()} · ${Math.round((progress.done / progress.of) * 100)}%` : stop.note}</span>
              </span>
              {/* A finished stop says how long it took; the one under way counts up, a second at a time. Discovering
                  and Fetching are reported when they start, so their time runs to the next stop; the rest when they end. */}
              <span className={cn("shrink-0 text-xs tabular-nums text-muted-foreground", current && "text-blue-600 dark:text-blue-400")}>{i === 0 || stop.key === "done" ? clock(times[i]) : current ? since(times[i] ?? times[i - 1] ?? times[0]) : OPENING.has(stop.key) ? took(times[i], times.slice(i + 1).find(Boolean) ?? null) : times[i] ? took(times.slice(0, i).reverse().find(Boolean) ?? times[0], times[i]) : ""}</span>
            </li>
          )
        })}
      </ol>
      {/* The fetch itself, as a bar of its own under the stops, from the loader's own count. */}
      {progress && at >= STOPS.findIndex((stop) => stop.key === "fetching") + 1 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-[width] duration-700", over ? "bg-emerald-500" : "bg-blue-500")} style={{ width: `${Math.min(100, (progress.done / progress.of) * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

export function RunProgress({ runs }: { runs: PipelineRun[] }) {
  // The newest first; a fleet is one line a box under one heading.
  const sorted = [...runs].sort((a, b) => b.launched.localeCompare(a.launched))
  const singles = sorted.filter((r) => r.mode === "single")
  const fleet = sorted.filter((r) => r.mode === "fleet")
  if (!sorted.length) return <div className="flex h-83 items-center justify-center"><WavePhysicsLoader /></div>
  return (
    <div className="scrollbar-none flex h-83 flex-col gap-6 overflow-y-auto">
      {singles.map((run) => (
        <Meter key={run.id} run={run} />
      ))}
      {fleet.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Fleet · {fleet.filter((r) => !isOver(r)).length} of {fleet.length} boxes up</p>
          {fleet.map((run) => {
            const { at, exit } = progressOf(run)
            const failed = (exit !== null && exit !== 0) || (isOver(run) && exit === null)
            return (
              <div key={run.id} className="flex items-center gap-2.5 text-xs">
                <span className="w-24 shrink-0 truncate font-mono text-muted-foreground">{(run.states ?? []).join(" ") || run.shard || run.name}</span>
                <span className="flex flex-1 gap-0.5">
                  {STOPS.map((stop, i) => (
                    <span key={stop.key} className={cn("h-1.5 flex-1 rounded-full", i < at ? (failed ? "bg-destructive" : i === STOPS.length - 1 ? "bg-emerald-500" : "bg-blue-500") : "bg-muted")} />
                  ))}
                </span>
                <span className="w-28 shrink-0 truncate text-right text-muted-foreground">{failed ? "ended early" : STOPS[at - 1].label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** The run's own words, in the large slot (Brendan, 2026-09-20: "this is great it deserves the left large slot"). It follows the newest line unless the reader has scrolled up to read. */
export function RunLog({ runs }: { runs: PipelineRun[] }) {
  const run = [...runs].filter((r) => r.mode === "single" && r.log.length > 0).sort((a, b) => b.launched.localeCompare(a.launched))[0]
  const box = React.useRef<HTMLPreElement>(null)
  const pinned = React.useRef(true)
  React.useEffect(() => {
    const el = box.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [run?.log.length])
  // Waiting is the wave loader, never a sentence (Brendan, 2026-09-20).
  if (!run) return <div className="flex h-83 items-center justify-center"><WavePhysicsLoader /></div>
  return (
    <pre
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
      }}
      className="scrollbar-none m-0 h-83 overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words text-muted-foreground"
    >
      {run.log.join("\n")}
    </pre>
  )
}
