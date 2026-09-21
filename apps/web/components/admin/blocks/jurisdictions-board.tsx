"use client"

import * as React from "react"
import { PauseIcon, PlayIcon, RocketIcon, SquareIcon } from "lucide-react"

import { stateName } from "@/lib/filters"
import { fmtCompact, fmtNumber } from "@/lib/format"
import { ROUTE_LABEL, sourceOf } from "@/lib/pipeline/sources"
import { isOver, type Pipeline, type PipelineRun } from "@/lib/pipeline/use-pipeline"
import { CodeLines } from "@/components/code-block"
import { CodeCollapsibleWrapper } from "@/components/code-collapsible-wrapper"
import { FlagChip } from "@/components/policy/imagery"
import { Dialog, DialogDescription, DialogHeader, DialogPopup, DialogTitle } from "@govblock/ui/components/animate-ui/components/base/dialog"
import { cn } from "@govblock/ui/lib/utils"

// The Jurisdictions card's board (Brendan, 2026-09-20). A card's face is its
// flag, its dot and its name; everything else is in the module the card opens
// — how its bill text is fetched: who, what, where, when, how, what is wrong,
// what would be better, with the numbers on file. Opening one also scopes the
// Volume chart and the loader chart beside it to that jurisdiction, until the
// card's header clears it. On hover a card offers a play button (bottom right)
// that fetches that one jurisdiction now; a running card pulses blue, says what
// it is doing, and carries pause and stop.
// First in the grid is Fleet Run: as many boxes as the account allows, every
// walked jurisdiction at once, each a shard of the outstanding documents.
//
// One connection per host is the rule, so a fleet and single runs never run
// together: the fleet's launch stops the singles first, and says so.
// Pause and stop both end the instance — the database is the coordinator, and
// what a run had not fetched is simply still outstanding — but a paused card
// remembers it, and its play button reads as resume.

export type BoardState = { state: string; bills: number; sessions: number }
type Dot = { tone: string; blink: boolean; label: string }
type Act = (body: { action: "single"; state: string } | { action: "fleet"; boxes?: number } | { action: "stop"; target: string }) => Promise<boolean>

const PAUSED = "pipeline:paused"
const icon = "inline-flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5"

function usePaused() {
  const [paused, setPaused] = React.useState<string[]>([])
  React.useEffect(() => {
    try {
      setPaused(JSON.parse(window.localStorage.getItem(PAUSED) ?? "[]") as string[])
    } catch {}
  }, [])
  const set = (next: string[]) => {
    setPaused(next)
    try {
      window.localStorage.setItem(PAUSED, JSON.stringify(next))
    } catch {}
  }
  return { paused, pause: (key: string) => set([...new Set([...paused, key])]), resume: (key: string) => set(paused.filter((k) => k !== key)) }
}

export function JurisdictionsBoard({ states, dot, pipeline, busy, act, selected, onInfo }: { states: BoardState[]; dot: (state: string) => Dot; pipeline: Pipeline | null; busy: boolean; act: Act; selected: string | null; /** Opens the jurisdiction's module. */ onInfo: (state: string) => void }) {
  const { paused, pause, resume } = usePaused()
  // The board lists the last hour's finished runs too; only the ones still up light a card.
  const runs = (pipeline?.runs ?? []).filter((r) => !isOver(r))
  const fleet = runs.filter((r) => r.mode === "fleet")
  const singles = runs.filter((r) => r.mode === "single")
  const landing = new Map((pipeline?.recent ?? []).map((r) => [r.state, r.n]))
  const canRun = !!pipeline?.canRun
  // A jurisdiction that has been run comes to the front (Brendan, 2026-09-20): row one, column one, the newest run
  // first, everything else moving along behind it, for as long as the run stays on the board (about an hour).
  const ranAt = new Map<string, string>()
  for (const r of pipeline?.runs ?? []) if (r.mode === "single" && r.state && (ranAt.get(r.state) ?? "") < r.launched) ranAt.set(r.state, r.launched)
  const ordered = [...states].sort((a, b) => (ranAt.get(b.state) ?? "").localeCompare(ranAt.get(a.state) ?? ""))
  const ran = ordered.filter((s) => ranAt.has(s.state))
  const rest = ordered.filter((s) => !ranAt.has(s.state))
  const [confirm, setConfirm] = React.useState(false)
  const boxes = Math.min(pipeline?.room?.boxes ?? 0, 24)

  const launchFleet = async () => {
    setConfirm(false)
    if (singles.length && !(await act({ action: "stop", target: "single" }))) return
    resume("fleet")
    await act({ action: "fleet" })
  }

  const tile = (s: BoardState) => {
        const run: PipelineRun | undefined = singles.find((r) => r.state === s.state)
        // Under a fleet each box owns its jurisdictions, discovery to fetch, so a card is lit by its own box.
        const box = fleet.find((r) => (r.states ?? []).includes(s.state))
        const active = !!run || !!box
        const phase = (run ?? box)?.stages.some((st) => st.stage === "fetching") ? "fetching…" : (run ?? box)?.stages.some((st) => st.stage === "discovering") ? "discovering…" : "box starting…"
        const base = dot(s.state)
        // For the hour a finished run stays on the board its card says how it went (Brendan, 2026-09-20): green and
        // blinking for a clean exit, red for anything else. The feed's own dot returns after that.
        const last = (pipeline?.runs ?? []).filter((r) => (r.states ?? (r.state ? [r.state] : [])).includes(s.state) && isOver(r)).sort((a, b) => b.launched.localeCompare(a.launched))[0]
        const exit = last?.stages.find((st) => st.stage.startsWith("done:"))?.stage.split(":")[1]
        const after = !last ? null : exit === "0" ? "animate-pulse bg-green-500" : "bg-red-500"
        const isPaused = paused.includes(s.state)
        const runnable = canRun
        return (
          <div
            key={s.state}
            role="button"
            tabIndex={0}
            aria-pressed={selected === s.state}
            title={active ? "fetching now" : last ? (exit === "0" ? "fetched just now" : "its last run did not finish cleanly") : base.label}
            onClick={() => onInfo(s.state)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onInfo(s.state))}
            className={cn(
              "group/tile relative flex h-[132px] cursor-pointer flex-col justify-between rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40",
              selected === s.state && "ring-2 ring-foreground/60",
              active && "border-blue-500/50"
            )}
          >
            <div className="flex items-start justify-between">
              <FlagChip state={s.state} width={36} />
              <span className={cn("mt-1 size-2.5 rounded-full", active ? "animate-pulse bg-blue-500" : isPaused ? "bg-amber-500" : (after ?? base.tone), !active && !after && base.blink && "animate-pulse")} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{stateName(s.state)}</p>
              {/* A line only while something is happening; the rest is in the module. */}
              {(active || isPaused) && <p className="truncate text-xs text-muted-foreground tabular-nums">{active ? (landing.get(s.state) ? `${fmtNumber(landing.get(s.state))} texts in 15 min` : phase) : "paused"}</p>}
            </div>
            {runnable && (
              <div className={cn("absolute right-3 bottom-3 flex gap-1", !run && "opacity-0 group-hover/tile:opacity-100 focus-within:opacity-100")}>
                {run ? (
                  <>
                    <button type="button" aria-label={`Pause ${stateName(s.state)}`} disabled={busy} className={icon} onClick={(e) => (e.stopPropagation(), pause(s.state), void act({ action: "stop", target: run.id }))}>
                      <PauseIcon />
                    </button>
                    <button type="button" aria-label={`Stop ${stateName(s.state)}`} disabled={busy} className={icon} onClick={(e) => (e.stopPropagation(), resume(s.state), void act({ action: "stop", target: run.id }))}>
                      <SquareIcon />
                    </button>
                  </>
                ) : (
                  <button type="button" aria-label={isPaused ? `Resume ${stateName(s.state)}` : `Fetch ${stateName(s.state)} now`} disabled={busy || fleet.length > 0} className={icon} onClick={(e) => (e.stopPropagation(), resume(s.state), void act({ action: "single", state: s.state }))}>
                    <PlayIcon />
                  </button>
                )}
              </div>
            )}
          </div>
        )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
      {ran.map(tile)}
      {canRun && (
        <div className={cn("relative flex h-[132px] flex-col justify-between rounded-xl border border-dashed bg-card p-4", fleet.length > 0 && "border-solid border-blue-500/50 ring-1 ring-blue-500/30")}>
          <div className="flex items-start justify-between">
            <RocketIcon className="size-6 text-muted-foreground" />
            <span className={cn("mt-1 size-2.5 rounded-full", fleet.length ? "animate-pulse bg-blue-500" : paused.includes("fleet") ? "bg-amber-500" : "bg-muted-foreground/30")} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">Fleet Run</p>
            {confirm ? (
              <p className="flex items-center gap-2 text-xs">
                <button type="button" onClick={launchFleet} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                  Launch {boxes}
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="text-muted-foreground hover:underline">
                  Cancel
                </button>
              </p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">{fleet.length ? `${fleet.length} boxes running` : paused.includes("fleet") ? "paused" : `${boxes} boxes available`}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">{confirm && singles.length ? `stops ${singles.length} single ${singles.length === 1 ? "run" : "runs"} first` : "every walked jurisdiction at once"}</p>
          </div>
          <div className="absolute right-3 bottom-3 flex gap-1">
            {fleet.length ? (
              <>
                <button type="button" aria-label="Pause the fleet" disabled={busy} className={icon} onClick={() => (pause("fleet"), void act({ action: "stop", target: "fleet" }))}>
                  <PauseIcon />
                </button>
                <button type="button" aria-label="Stop the fleet" disabled={busy} className={icon} onClick={() => (resume("fleet"), void act({ action: "stop", target: "fleet" }))}>
                  <SquareIcon />
                </button>
              </>
            ) : (
              <button type="button" aria-label={paused.includes("fleet") ? "Resume the fleet" : "Launch the fleet"} disabled={busy || boxes < 1} className={icon} onClick={() => setConfirm(true)}>
                <PlayIcon />
              </button>
            )}
          </div>
        </div>
      )}
      {rest.map(tile)}
    </div>
  )
}

// A timestamp as the database prints it ("2026-08-30 21:21:14.49+00") is not one JavaScript parses; the day is what is shown.
const when = (iso: string | null | undefined) => {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(iso ?? "")?.[0]
  return day ? new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "never"
}

/**
 * How one jurisdiction's bill text is fetched: the registry's account, with what is on file. Drawn in the dashboard's
 * own frame (Brendan, 2026-09-20): the grey ground, the white shell with its 1px border, a header, the content, a footer.
 */
export function SourceOverlay({ state, facts, pipeline, onClose }: { state: string | null; /** What the card's face used to carry. */ facts: { bills: number; sessions: number; pulled: string | null; label: string } | null; pipeline: Pipeline | null; onClose: () => void }) {
  const source = state ? sourceOf(state) : null
  const detail = pipeline?.detail
  const run = state ? pipeline?.runs.find((r) => r.state === state && !isOver(r)) : undefined
  const rows: [string, React.ReactNode][] = source ? [["Who", source.who], ["What", source.what], ["Where", <code key="w" className="text-[0.8rem] break-words">{source.where}</code>], ["When", source.when], ["How", source.how]] : []
  const tiles: [string, string][] = facts
    ? [
        ["Bills", fmtCompact(facts.bills, false)],
        ["Sessions", String(facts.sessions)],
        ["With text", detail?.totals ? `${Math.round((detail.totals.with_text / Math.max(1, detail.totals.bills)) * 1000) / 10}%` : "…"],
        ["Newest text", detail?.totals ? when(detail.totals.newest_text) : "…"],
      ]
    : []
  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup from="top" showCloseButton className="w-[min(760px,calc(100vw-2rem))] rounded-2xl border-0 bg-sidebar p-2 shadow-lg sm:max-w-none">
        {state && source && (
          <div className="flex max-h-[82vh] min-h-0 flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
            <DialogHeader className="flex h-(--header-height) shrink-0 flex-row items-center gap-3 border-b px-5 pr-12">
              <FlagChip state={state} width={36} />
              <DialogTitle className="text-base font-medium">{stateName(state)}</DialogTitle>
              <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">{ROUTE_LABEL[source.route]}</span>
              <DialogDescription className="sr-only">How {stateName(state)}'s bill text is fetched.</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-2 overflow-hidden rounded-xl border sm:grid-cols-4">
                {tiles.map(([label, value]) => (
                  <div key={label} className="border-r border-b p-4 last:border-r-0 sm:border-b-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              <dl className="mt-5 grid grid-cols-[4.5rem_1fr] gap-x-4 gap-y-3 text-sm">
                {rows.map(([label, value]) => (
                  <React.Fragment key={label}>
                    <dt className="font-medium text-muted-foreground">{label}</dt>
                    <dd className="m-0 min-w-0">{value}</dd>
                  </React.Fragment>
                ))}
                {source.problems.length > 0 && (
                  <>
                    <dt className="font-medium text-red-600 dark:text-red-400">Wrong</dt>
                    <dd className="m-0">
                      <ul className="m-0 list-disc space-y-1 pl-4">{source.problems.map((p) => <li key={p}>{p}</li>)}</ul>
                    </dd>
                  </>
                )}
                {source.improve.length > 0 && (
                  <>
                    <dt className="font-medium text-emerald-600 dark:text-emerald-400">Better</dt>
                    <dd className="m-0">
                      <ul className="m-0 list-disc space-y-1 pl-4">{source.improve.map((p) => <li key={p}>{p}</li>)}</ul>
                    </dd>
                  </>
                )}
              </dl>
              <div className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Texts on file, by loader</p>
                  <ul className="m-0 list-none space-y-1 p-0 tabular-nums">
                    {(detail?.sources ?? []).map((r) => (
                      <li key={r.source} className="flex justify-between gap-3">
                        <code className="text-[0.8rem]">{r.source}</code>
                        <span className="text-muted-foreground">{`${fmtNumber(r.with_text)} of ${fmtNumber(r.n)} · ${when(r.last)}`}</span>
                      </li>
                    ))}
                    {detail && !detail.sources.length && <li className="text-muted-foreground">None.</li>}
                    {!detail && <li className="text-muted-foreground">Reading…</li>}
                  </ul>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Where its documents live</p>
                  <ul className="m-0 list-none space-y-1 p-0 tabular-nums">
                    {(detail?.hosts ?? []).map((h) => (
                      <li key={h.host} className="flex justify-between gap-3">
                        <code className="truncate text-[0.8rem]">{h.host}</code>
                        <span className="text-muted-foreground">{fmtNumber(h.n)}</span>
                      </li>
                    ))}
                    {!detail && <li className="text-muted-foreground">Reading…</li>}
                  </ul>
                </div>
              </div>
              {/* The loader's own code for this jurisdiction (Brendan, 2026-09-20), each section under its file and lines. */}
              {(detail?.script ?? []).map((section) => (
                <div key={`${section.file}:${section.start}`} className="mt-5">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{section.title}</p>
                  <CodeCollapsibleWrapper title={`livingston/${section.file} · lines ${section.start}–${section.end}`} code={section.code} className="mt-0 mb-0">
                    <CodeLines code={section.code} start={section.start} />
                  </CodeCollapsibleWrapper>
                </div>
              ))}
              {detail && detail.script === null && <p className="mt-5 text-xs text-muted-foreground">The loader's code is read from the livingston checkout on the development machine; it is not available here.</p>}
            </div>
            <footer className="flex h-(--header-height) shrink-0 items-center justify-between gap-3 border-t px-5 text-xs text-muted-foreground">
              <span className="truncate">{facts?.pulled ? `pulled ${when(facts.pulled)} · ${facts.label}` : (facts?.label ?? "")}</span>
              {run && (
                <span className="flex shrink-0 items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <span className="size-2 animate-pulse rounded-full bg-blue-500" />
                  {run.name} · {run.status}
                </span>
              )}
            </footer>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  )
}
