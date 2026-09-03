"use client"

import * as React from "react"

import { fmtDate } from "@/lib/format"
import { cn } from "@govblock/ui/lib/utils"

// GitHub's commit list, as a layout: a rail down the left with a dot at each
// day, "Commits on Aug 29, 2026" over the day's rows, each row a title, a
// line of who-and-when, and a cluster of actions at its right. Brendan,
// 2026-09-03: "this exact same layout is also perfect for status or history or
// both" — so the rows are anything with a date, and the caller names the noun.

export type TimelineRow = {
  key: string
  date: string | null
  title: React.ReactNode
  meta?: React.ReactNode
  /** Right-aligned: an id, a copy button, a link. */
  actions?: React.ReactNode
  onClick?: () => void
}

/** "5 days ago", the way a commit list dates itself. */
export function ago(value: string | null | undefined) {
  if (!value) return ""
  const then = new Date(value).getTime()
  if (!Number.isFinite(then)) return ""
  const s = Math.max(0, (Date.now() - then) / 1000)
  const units: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.348, "week"],
    [12, "month"],
    [Infinity, "year"],
  ]
  let n = s
  for (const [size, name] of units) {
    if (n < size) {
      const whole = Math.floor(n)
      return whole <= 0 ? "just now" : `${whole} ${name}${whole === 1 ? "" : "s"} ago`
    }
    n /= size
  }
  return ""
}

export function Timeline({ rows, noun, end, className }: { rows: TimelineRow[]; noun: string; end?: string; className?: string }) {
  const groups = React.useMemo(() => {
    const out: { day: string; rows: TimelineRow[] }[] = []
    for (const row of rows) {
      const day = String(row.date ?? "").slice(0, 10) || "—"
      const last = out[out.length - 1]
      if (last && last.day === day) last.rows.push(row)
      else out.push({ day, rows: [row] })
    }
    return out
  }, [rows])

  return (
    <div className={cn("mx-auto w-full max-w-5xl px-6 py-6", className)}>
      {groups.map((g) => (
        <section key={g.day} className="relative ml-2 border-l pb-2 pl-6">
          <span aria-hidden className="absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-muted-foreground/60 bg-background" />
          <h3 className="mb-3 text-sm text-muted-foreground">
            {noun} on {g.day === "—" ? "an unknown date" : fmtDate(g.day)}
          </h3>
          <div className="mb-4 overflow-hidden rounded-lg border">
            {g.rows.map((row, i) => (
              <div key={row.key} data-clickable={!!row.onClick || undefined} onClick={row.onClick} className={cn("flex items-start gap-4 px-4 py-3", i > 0 && "border-t", row.onClick && "cursor-pointer hover:bg-muted/40")}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium [&_a]:hover:underline">{row.title}</div>
                  {row.meta && <div className="mt-1 text-xs text-muted-foreground">{row.meta}</div>}
                </div>
                {row.actions && (
                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {row.actions}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {end && (
        <div className="relative ml-2 pl-6">
          <span aria-hidden className="absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-muted-foreground/60 bg-background" />
          <p className="text-sm text-muted-foreground">{end}</p>
        </div>
      )}
    </div>
  )
}
