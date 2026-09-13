"use client"

import * as React from "react"
import { format } from "date-fns"

import { useActionsPanel } from "@/lib/typeset/actions-panel"
import { PaneAside } from "@/components/policy/pane-aside"
import { Prose } from "@/app/agents/transcript"

// The bill's actions beside the Typeset editor (Brendan, 2026-09-13): the
// aside the Git view opens for its outline, holding the bill's actions drawn
// the way /changelog draws what shipped. One entry per day, newest first —
// the dot on the line, the day as the title over a hairline — and under it
// the day's actions as the changelog's body: a heading per chamber, a bullet
// per action, the step number in the code chip where the commit hash goes.
// The body is markdown through the same renderer the changelog uses, so the
// two cannot drift apart.

type Action = { date: string; chamber: string; action: string; sequence: number }

function dayTitle(day: string) {
  const d = new Date(`${day}T00:00:00`)
  return Number.isNaN(d.getTime()) ? day : format(d, "MMMM d, yyyy")
}

/** The day's actions as the changelog writes a day: `### Chamber`, then a bullet per action. */
function dayMarkdown(actions: Action[]) {
  const byChamber = new Map<string, Action[]>()
  for (const a of actions) {
    const list = byChamber.get(a.chamber) ?? []
    list.push(a)
    byChamber.set(a.chamber, list)
  }
  return [...byChamber.entries()]
    .map(([chamber, rows]) => [`### ${chamber}`, "", ...rows.map((a) => `- ${a.action} (\`${String(a.sequence).padStart(3, "0")}\`)`)].join("\n"))
    .join("\n\n")
}

export function TypesetActionsAside() {
  const panel = useActionsPanel()
  const history = panel?.bill?.history
  const days = React.useMemo(() => {
    const sorted = [...(history ?? [])].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : Number(b.sequence) - Number(a.sequence)))
    const out: { day: string; actions: Action[] }[] = []
    for (const a of sorted) {
      const day = String(a.date ?? "").slice(0, 10)
      const last = out[out.length - 1]
      if (last && last.day === day) last.actions.push(a)
      else out.push({ day, actions: [a] })
    }
    return out
  }, [history])
  const count = history?.length ?? 0
  if (!panel?.open || !panel.bill) return null
  return (
    <PaneAside title={`Actions · ${count}`} onClose={panel.close}>
      <div className="relative px-3 py-4">
        {/* The indicator line the day dots ride. */}
        <div aria-hidden className="absolute inset-y-0 start-[19.5px] w-px bg-border" />
        <div className="flex flex-col gap-y-8">
          {days.length === 0 && <p className="text-xs text-muted-foreground">No actions recorded for this bill yet.</p>}
          {days.map((day) => (
            <article key={day.day} className="relative flex items-start gap-3">
              <div className="my-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-background ring ring-border">
                <div className="size-2 rounded-full bg-primary" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="border-b border-border pb-2">
                  <h2 className="relative text-sm font-semibold text-pretty text-foreground">
                    <time dateTime={day.day}>{dayTitle(day.day)}</time>
                  </h2>
                </div>
                <div className="py-3 text-xs whitespace-pre-wrap">
                  <Prose text={dayMarkdown(day.actions)} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </PaneAside>
  )
}
