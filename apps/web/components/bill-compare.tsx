"use client"

import * as React from "react"
import Link from "next/link"

import { cn } from "@govblock/ui/lib/utils"
import type { BillComparison, CompareRow } from "@/lib/policy/bill-compare"

import "./policy/diff-view.css"
import "./bill-compare.css"

// A bill's printings, each against the one before it, read top to bottom as
// one redline (2026-09-11). Each change happens at the reading line, two
// thirds down the screen: the lines it removes are struck through in red,
// left to right, and a beat behind the strike the lines it adds are marked in
// with a green highlighter as they come up from faded to full
// (bill-compare.css). Scrolling back undoes it, so an edit can be watched
// again. Unchanged text never moves.
//
// How it got here, from Brendan's notes the same night: the first build ran
// the page through ParticleScroll (html-in-canvas) so removed lines crumbled
// and added lines condensed out of sand. The crumbled lines were never
// readable, and the sand hid the new text until it settled. The page now uses
// no canvas at all — plain CSS on an ordinary record page, the same in every
// browser.
//
// The rows come from `lineDiff` in reflow mode, the diff the repository view
// uses: words compared, not lines, so a line that only re-wrapped in the
// reprint is context, and the changed words inside a line are marked. The
// palette is the repository view's (GitHub's Primer, diff-view.css).
//
// Two settings, which Typeset's Diff page puts in its footer (Brendan,
// 2026-09-11). Width: centred, the text column's own width capped near the
// printed measure; or full, every row across the whole pane, which lets the
// eye follow a coloured line from one side to the other. Lock: locked, a
// change once shown stays shown; unlocked, scrolling back undoes it.

export type CompareWidth = "centered" | "full"

/** The reading line, as a fraction of the viewport. */
const LINE = 0.68
/** Each line of a changed paragraph starts this long after the one above… */
const ROW_BEAT = 140
/** …unless that would make the paragraph outlast this. */
const ROW_SPAN = 1500
/** A run's sweep starts up to this far into its line's beat, by where it sits on the line. */
const SWEEP = 360
/** Additions start this long after the strike of the lines they replace. */
const AFTER_STRIKE = 320

/**
 * Sets each change when it reaches the reading line — at its first added
 * line, or its first removed line when nothing was added — and, unless
 * `locked`, clears it if the reader scrolls back. At the very bottom every
 * change on screen counts as reached, since the last ones can never rise that
 * far. The scroller is the window, or `root` itself when it is `contained`.
 */
function useChanges(root: HTMLElement | null, { locked, contained }: { locked: boolean; contained: boolean }) {
  React.useEffect(() => {
    if (!root) return
    const target: HTMLElement | Window = contained ? root : window
    const view = () =>
      contained
        ? { top: root.getBoundingClientRect().top, height: root.clientHeight, atEnd: root.scrollTop + root.clientHeight >= root.scrollHeight - 2 }
        : { top: 0, height: window.innerHeight, atEnd: window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2 }
    const changes = new Map<string, { trigger: HTMLElement; rows: HTMLElement[] }>()
    root.querySelectorAll<HTMLElement>("[data-block]").forEach((row) => {
      const key = row.dataset.block!
      const entry = changes.get(key)
      if (!entry) changes.set(key, { trigger: row, rows: [row] })
      else {
        entry.rows.push(row)
        if (row.dataset.side === "add" && entry.trigger.dataset.side !== "add") entry.trigger = row
      }
    })
    const list = [...changes.values()]

    let frame = 0
    const update = () => {
      frame = 0
      const { top, height, atEnd } = view()
      const line = top + height * (atEnd ? 1 : LINE)
      for (const change of list) {
        const reached = change.trigger.getBoundingClientRect().top < line
        for (const row of change.rows) {
          const attr = row.dataset.side === "add" ? "data-arrived" : "data-struck"
          const shown = row.hasAttribute(attr)
          if (reached && !shown) row.setAttribute(attr, "")
          else if (!reached && shown && !locked) row.removeAttribute(attr)
        }
      }
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    target.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      target.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [root, locked, contained])
}

export function BillCompare({
  href,
  number,
  title,
  printings,
  passes,
  width = "centered",
  locked = true,
  contained = false,
}: BillComparison & {
  width?: CompareWidth
  locked?: boolean
  /** Scroll inside its own box (Typeset's pane) rather than with the page. */
  contained?: boolean
}) {
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null)
  useChanges(root, { locked, contained })
  return (
    <div ref={setRoot} className={cn("w-full px-4 pt-8 pb-24 sm:px-8", contained && "h-full overflow-y-auto")}>
      <header className="mx-auto max-w-3xl">
        <Link href={href} className="font-mono text-sm text-muted-foreground hover:text-foreground">
          {number}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{printings.join(" → ")}</p>
      </header>
      {passes.map((pass, p) => (
        <section key={`${pass.from}-${pass.to}`} className="mt-12">
          <h2 className="mx-auto mb-4 max-w-3xl text-sm font-semibold">
            {pass.from} → {pass.to}
          </h2>
          <Redline rows={pass.rows} pass={p} width={width} />
        </section>
      ))}
    </div>
  )
}

const SIGN = { same: "", add: "+", del: "−" } as const

function Redline({ rows, pass, width }: { rows: CompareRow[]; pass: number; width: CompareWidth }) {
  // How many lines each change removes and adds, to pace its lines' beats.
  const counts = new Map<number, { del: number; add: number }>()
  for (const row of rows) {
    if (row.block === undefined || row.change === "same") continue
    const c = counts.get(row.block) ?? { del: 0, add: 0 }
    c[row.change] += 1
    counts.set(row.block, c)
  }
  const rowDelay = (row: CompareRow) => {
    const c = counts.get(row.block ?? -1) ?? { del: 0, add: 0 }
    const n = row.change === "add" ? c.add : c.del
    const beat = (row.order ?? 0) * Math.min(ROW_BEAT, ROW_SPAN / Math.max(n, 1))
    return Math.round(beat + (row.change === "add" && c.del ? AFTER_STRIKE : 0))
  }

  return (
    // Centred: the column is as wide as the text's longest line up to about
    // the printed measure, and a longer line (a federal text's run-together
    // header, say) wraps rather than widening the column for the whole bill.
    // Full: every row spans the pane.
    <div className={cn("gh-diff flex w-full bg-transparent", width === "centered" && "justify-center")}>
      <pre
        className={cn(
          "m-0 max-w-full p-0 font-mono text-[13px] leading-[1.35] text-foreground",
          width === "centered" ? "w-fit max-w-[min(100%,92ch)] whitespace-pre-wrap" : "w-full overflow-x-auto whitespace-pre"
        )}
      >
        {rows.map((row, index) => {
          const changed = row.change !== "same"
          return (
            <div
              key={index}
              data-block={changed && row.block !== undefined ? `${pass}:${row.block}` : undefined}
              data-side={changed ? row.change : undefined}
              style={changed ? ({ "--row-delay": `${rowDelay(row)}ms` } as React.CSSProperties) : undefined}
              className={cn(
                "flex",
                row.furniture && !changed && "opacity-40",
                row.change === "add" && "compare-added",
                row.change === "del" && "compare-removed"
              )}
            >
              <span aria-hidden className={cn("w-[3ch] shrink-0 text-center text-muted-foreground select-none", changed && "compare-sign")}>
                {SIGN[row.change]}
              </span>
              <span className="min-h-[1.35em] pr-4">
                <Marked row={row} />
              </span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}

/**
 * The line with its changed words marked: a removal's struck runs — its
 * marked words, or the whole text when nothing narrower is marked — and an
 * addition's highlighted words. Each run's sweep starts in proportion to
 * where it sits on the line.
 */
function Marked({ row }: { row: CompareRow }) {
  const { text, change, marks } = row
  if (change === "same") return <>{text}</>
  const delay = (from: number) => ({ "--strike-delay": `${Math.round((from / Math.max(text.length, 1)) * SWEEP)}ms` }) as React.CSSProperties
  if (!marks?.length) {
    // A whole added line is marked by its row's own sweep.
    if (change === "add") return <>{text}</>
    const lead = text.length - text.trimStart().length
    return (
      <>
        {text.slice(0, lead)}
        <span className="compare-strike" style={delay(lead)}>
          {text.slice(lead)}
        </span>
      </>
    )
  }
  const pieces: React.ReactNode[] = []
  let at = 0
  marks.forEach((m, i) => {
    if (m.from > at) pieces.push(text.slice(at, m.from))
    pieces.push(
      <span key={i} className={cn("rounded-[3px]", change === "add" ? "compare-highlight" : "compare-strike compare-word")} style={delay(m.from)}>
        {text.slice(m.from, m.to)}
      </span>
    )
    at = m.to
  })
  if (at < text.length) pieces.push(text.slice(at))
  return <>{pieces}</>
}
