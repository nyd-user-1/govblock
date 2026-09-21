"use client"

import * as React from "react"

// The Database dashboard's live board, client side (Brendan, 2026-09-20): what
// is running, what is landing, texts a day by loader, and one state's detail.
// It asks once when the page opens and again every ten seconds only while a
// run is up — a board with nothing running does not poll the database.

export type PipelineRun = { id: string; status: string; launched: string; mode: "single" | "fleet"; state: string | null; shard: string | null; /** The jurisdictions this box owns: one for a single run, a fleet box's hand otherwise. */ states: string[]; name: string; /** The steps the box has reported, in order: aws, tools, node, loader, fetching, done:<exit>. */ stages: { stage: string; at: string | null }[]; /** The tail of a single run's log. */ log: string[] }

/** A run that is over: EC2 keeps a terminated instance in view for about an hour, and so does the board. */
export const isOver = (run: PipelineRun) => run.status === "terminated" || run.status === "shutting-down" || run.status === "stopped"
export type PipelineLedgerRow = { run: string; state: string; mode: string | null; started: string; finished: string | null; exit: number | null; discover_source: string | null; discover_result: string | null; discover_exit: number | null; fetch_source: string | null; considered: number; stored: number; skipped: number; note: string | null }
export type PipelineDetail = {
  sources: { source: string; n: number; with_text: number; last: string | null }[]
  hosts: { host: string; n: number }[]
  totals: { bills: number; with_text: number; newest_action: string | null; newest_text: string | null } | null
  /** The loader's code for this jurisdiction: the driver's branch, the handler's function. Null off the development machine. */
  script: { file: string; title: string; start: number; end: number; code: string }[] | null
}
export type Pipeline = {
  canRun: boolean
  runs: PipelineRun[]
  /** The run log, newest first: what each run did for each jurisdiction it owned. */
  ledger?: PipelineLedgerRow[]
  /** Each jurisdiction's bills and bills holding text now, beside what it held before the span's first run. */
  updates?: { state: string; bills: number; with_text: number; base_bills: number; base_text: number; base_at: string }[]
  room: { limit: number; used: number; boxes: number } | null
  recent: { state: string; n: number; at: string }[]
  minutes: { minute: string; n: number }[]
  daily: { day: string; source: string; n: number }[]
  byState: { state: string; source: string; n: number; last: string | null }[]
  detail: PipelineDetail | null
}

// Five seconds while a run is up: the meter's stops come a few seconds apart (Brendan, 2026-09-20).
const POLL = 5_000

export function usePipeline({ state, days, detail }: { state: string | null; days: number; detail: boolean }) {
  const [data, setData] = React.useState<Pipeline | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const running = (data?.runs ?? []).some((r) => !isOver(r))

  const load = React.useCallback(
    async (live: boolean) => {
      const params = new URLSearchParams({ days: String(days), room: "1" })
      if (state) params.set("state", state)
      if (detail && state) params.set("detail", "1")
      if (live) params.set("live", "1")
      const r = await fetch(`/api/pipeline?${params}`).catch(() => null)
      if (!r?.ok) return setError(r?.status === 403 ? "Sign in as an admin to see the pipeline." : "The pipeline did not answer.")
      setError(null)
      setData((await r.json()) as Pipeline)
    },
    [state, days, detail]
  )

  React.useEffect(() => void load(running), [load]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => void load(true), POLL)
    return () => {
      window.clearInterval(id)
      // A run that has just ended still has its last words to say — its final stop, its exit, the end of its log —
      // so the board looks twice more before it goes quiet.
      window.setTimeout(() => void load(true), 15_000)
      window.setTimeout(() => void load(true), 45_000)
    }
  }, [running, load])

  /** Start or stop a run; the answer's refusal, if any, is a sentence for the reader. */
  const act = React.useCallback(
    async (body: { action: "single"; state: string } | { action: "fleet"; boxes?: number } | { action: "stop"; target: string }) => {
      setBusy(true)
      const r = await fetch("/api/pipeline", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null)
      const answer = (await r?.json().catch(() => null)) as { error?: string } | null
      setBusy(false)
      await load(true)
      if (!r?.ok) {
        setError(answer?.error ?? "That did not work.")
        return false
      }
      return true
    },
    [load]
  )

  return { data, error, busy, running, act, refresh: () => load(running) }
}
