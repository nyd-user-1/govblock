"use client"

import * as React from "react"
import { LoadingFlag } from "@/components/loading-flag"
import { CheckIcon, CopyIcon } from "lucide-react"

import { CONGRESS, STATE_CODES, stateName } from "@/lib/filters"
import type { StateStats } from "@/lib/policy/state-stats"
import { CHARTS, StateChart, type ChartId } from "@/components/charts/state-charts"
import { FlagChip } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/nova/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@govblock/ui/components/nova/select"
import { cn } from "@govblock/ui/lib/utils"

// The studio (Brendan, 2026-09-13), a prototype: pick a jurisdiction and a
// chart, see it drawn from the record, and take it with you — the embed
// address, or the numbers as JSON. On bklit's studio idea, without its
// weight: the charts are the same plain SVG the state pages draw, and the
// only fetch is one JSON of the jurisdiction's numbers.

export function Studio({ initialState }: { initialState: string }) {
  const [state, setState] = React.useState(initialState)
  const [chart, setChart] = React.useState<ChartId>("seats")
  const [stats, setStats] = React.useState<StateStats | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [copied, setCopied] = React.useState<string | null>(null)
  React.useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/policy/state-stats?state=${state}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: StateStats | null) => {
        if (alive) setStats(j)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [state])
  const embed = typeof window !== "undefined" ? `${window.location.origin}/state/${state.toLowerCase()}/charts/embed?chart=${chart}` : ""
  const copy = async (what: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(what)
    window.setTimeout(() => setCopied(null), 1500)
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Jurisdiction</span>
          <Select value={state} onValueChange={(v) => v && setState(String(v))}>
            <SelectTrigger className="w-full">
              <span className="flex items-center gap-2">
                <FlagChip state={state} width={20} />
                {state === CONGRESS ? "Congress" : stateName(state)}
              </span>
            </SelectTrigger>
            <SelectContent align="start" className="max-h-80 w-max min-w-44">
              {[CONGRESS, ...STATE_CODES.filter((c) => c !== CONGRESS)].map((code) => (
                <SelectItem key={code} value={code} className="whitespace-nowrap">
                  <FlagChip state={code} width={20} />
                  {code === CONGRESS ? "Congress" : stateName(code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Chart</span>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {CHARTS.map((c) => (
              <li key={c.id} className="m-0 p-0">
                <button type="button" onClick={() => setChart(c.id)} className={cn("w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent", chart === c.id && "bg-accent font-medium")}>
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" onClick={() => copy("embed", embed)} className="justify-start gap-2">
            {copied === "embed" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            Copy embed link
          </Button>
          <Button variant="outline" size="sm" onClick={() => copy("json", JSON.stringify(stats, null, 1))} disabled={!stats} className="justify-start gap-2">
            {copied === "json" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            Copy the numbers as JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => copy("iframe", `<iframe src="${embed}" width="720" height="420" style="border:0"></iframe>`)} className="justify-start gap-2">
            {copied === "iframe" ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            Copy iframe
          </Button>
        </div>
      </aside>
      <section className="flex min-h-[420px] flex-col gap-4 rounded-xl border bg-card p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-base font-semibold">{CHARTS.find((c) => c.id === chart)?.title}</h2>
          <span className="text-xs text-muted-foreground">{stats ? `${stats.name} · session ${stats.session}` : ""}</span>
        </div>
        {stats ? <StateChart id={chart} stats={stats} /> : <p className="text-sm text-muted-foreground">{loading ? <LoadingFlag /> : "Nothing on the record for this jurisdiction."}</p>}
      </section>
    </div>
  )
}
