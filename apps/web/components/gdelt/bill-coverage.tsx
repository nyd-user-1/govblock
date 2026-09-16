"use client"

import * as React from "react"

import { Button } from "@govblock/ui/components/nova/button"
import { AttentionChart } from "@/components/gdelt/charts"
import { LoadingFlag } from "@/components/loading-flag"

// A bill's coverage, on a reader's press (Brendan, 2026-09-16). The call goes
// out only when the button is pressed, the answer is cached for a week against
// the phrase, and GDELT's refusal is reported in words rather than as an empty
// panel. This is the shape the panel would take on a bill page.

type Coverage = {
  phrase: string
  readAt: string
  total: number
  curve: { date: string; articles: number; share: number }[]
  articles: { url: string; title: string; domain: string; date: string; image: string | null }[]
}

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const when = (iso: string) => (iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}` : "")

export function BillCoverage({ phrase, label }: { phrase: string; label: string }) {
  const [state, setState] = React.useState<"idle" | "asking">("idle")
  const [answer, setAnswer] = React.useState<Coverage | null>(null)
  const [failed, setFailed] = React.useState<string | null>(null)

  const ask = async () => {
    setState("asking")
    setFailed(null)
    try {
      const r = await fetch("/api/gdelt/bill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phrase }) })
      const body = await r.json()
      if (!r.ok) setFailed(body.error ?? "GDELT did not answer.")
      else setAnswer(body as Coverage)
    } catch {
      setFailed("GDELT did not answer.")
    }
    setState("idle")
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="font-mono text-sm font-semibold">{label}</span>
          <span className="truncate text-xs text-muted-foreground">{phrase}</span>
        </span>
        {answer ? (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{answer.total.toLocaleString()} articles</span>
        ) : (
          <Button variant="outline" size="sm" onClick={ask} disabled={state === "asking"}>
            Coverage
          </Button>
        )}
      </div>
      {state === "asking" ? (
        <div className="flex justify-center py-6">
          <LoadingFlag />
        </div>
      ) : null}
      {failed ? <p className="text-sm text-muted-foreground">{failed}</p> : null}
      {answer ? (
        <>
          {answer.curve.some((p) => p.articles > 0) ? <AttentionChart rows={answer.curve} peaks={[]} /> : <p className="text-sm text-muted-foreground">No coverage under that name in the last year.</p>}
          <ul className="flex flex-col divide-y">
            {answer.articles.slice(0, 5).map((a) => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-0.5 py-2 no-underline hover:bg-muted/40">
                  <span className="line-clamp-2 text-sm text-foreground">{a.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {a.domain} · {when(a.date)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <span className="text-xs text-muted-foreground">Read {answer.readAt} UTC, kept for a week</span>
        </>
      ) : null}
    </div>
  )
}
