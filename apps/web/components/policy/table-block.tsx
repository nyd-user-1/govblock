"use client"

import * as React from "react"

import { fmtNumber } from "@/lib/format"
import { Button } from "@govblock/ui/components/nova/button"
import { CopyButton } from "@/components/copy-button"

// The surface block Brendan dropped over the tables (2026-09-08): the first ten
// rows — five where a caller asks for it — See more at the bottom left for the
// rest, copy at the top right on hover. No scroller — the list is as tall as it
// is.
//
// The clipboard reads the rendered table rather than a second copy of the rows,
// so a server component can use this without shipping its rows twice.

const SHOWN = 10

// How many rows stand before See more. Tailwind wants the whole class name, so
// the two a caller can ask for are written out rather than built (2026-09-22).
const CLIP: Record<number, string> = {
  5: "data-[open=false]:[&_tbody_tr:nth-child(n+6)]:hidden",
  10: "data-[open=false]:[&_tbody_tr:nth-child(n+11)]:hidden",
}

/** The rendered table as TSV, which is what a spreadsheet wants on paste. */
function tableText(root: HTMLElement | null) {
  const table = root?.querySelector("table")
  if (!table) return ""
  return [...table.querySelectorAll("tr")]
    .map((row) => [...row.querySelectorAll("th,td")].map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim()).join("\t"))
    .filter((line) => line.replace(/\t/g, "").length)
    .join("\n")
}

export function TableBlock({ children, rows, shown = SHOWN }: { children: React.ReactNode; rows: number; /** Rows before See more; 5 or 10. */ shown?: 5 | 10 }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const [text, setText] = React.useState("")
  const hidden = Math.max(0, rows - shown)

  React.useEffect(() => setText(tableText(ref.current)), [open, children])

  return (
    <div className="group relative mt-6 flex flex-col gap-2 rounded-2xl bg-surface p-6 text-sm text-surface-foreground">
      <CopyButton
        value={text}
        aria-label="Copy table"
        className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      />
      <div ref={ref} data-open={open} className={CLIP[shown]}>
        {children}
      </div>
      {hidden > 0 && (
        <div className="flex">
          <Button variant="outline" size="sm" onClick={() => setOpen((was) => !was)}>
            {open ? "See fewer" : `See more (${fmtNumber(hidden)})`}
          </Button>
        </div>
      )}
    </div>
  )
}
