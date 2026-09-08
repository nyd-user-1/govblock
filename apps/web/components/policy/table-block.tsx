"use client"

import * as React from "react"

import { fmtNumber } from "@/lib/format"
import { Button } from "@govblock/ui/components/nova/button"
import { CopyButton } from "@/components/copy-button"
import { PreviewFrame } from "@/components/preview-frame"

// A long table in the docs frame — CardBlock's block, for a table instead of a
// grid (Brendan, 2026-09-08). The rounded frame, a copy button that fades in at
// its top right on hover, the rows in a scroller, and See more at the bottom
// left.
//
// Two things fall out of that and are deliberate:
//
//  - **It scrolls whether or not it is open.** The scroller is shorter than the
//    rows it holds in both states, so a reader who never touches See more can
//    still read the whole of what is shown. See more raises the ceiling and
//    reveals the rest; it does not turn scrolling on.
//  - **The clipboard reads the rendered table**, not a second copy of the rows
//    handed in beside it. Whatever is on the page is what is copied, the two
//    cannot drift, and a server component can use this without shipping its
//    rows twice.
//
// Ten rows before See more, fixed rather than a prop: the hiding is a CSS
// nth-child rule and Tailwind cannot generate a class for a number it only
// learns at runtime. Ten is what the block was drawn at.

const SHOWN = 10

/** The rendered table as TSV, which is what a spreadsheet wants on paste. */
function tableText(root: HTMLElement | null) {
  const table = root?.querySelector("table")
  if (!table) return ""
  const cells = (row: Element) => [...row.querySelectorAll("th,td")].map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim())
  return [...table.querySelectorAll("tr")]
    .map((row) => cells(row).join("\t"))
    .filter((line) => line.replace(/\t/g, "").length)
    .join("\n")
}

export function TableBlock({
  children,
  rows,
  menu,
}: {
  /** The table itself, rendered by the page that knows its columns. */
  children: React.ReactNode
  /** How many rows the table holds, so See more can say how many are behind it. */
  rows: number
  /** What sits above the table at the right: a block's own control. */
  menu?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const [text, setText] = React.useState("")
  const hidden = Math.max(0, rows - SHOWN)

  // Read the table once it is on the page, and again when See more changes what
  // is on it, so the clipboard holds what the reader can see.
  React.useEffect(() => setText(tableText(ref.current)), [open, children])

  return (
    <PreviewFrame>
      <CopyButton
        value={text}
        aria-label="Copy table"
        className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      />
      {menu && <div className="flex items-center pb-4">{menu}</div>}
      <div
        ref={ref}
        data-open={open}
        // The ceiling in both states, and the rule that hides the rows past the
        // tenth while it is closed.
        className="scrollbar-none max-h-[22rem] overflow-y-auto overscroll-contain data-[open=true]:max-h-[38rem] data-[open=false]:[&_tbody_tr:nth-child(n+11)]:hidden"
      >
        {children}
      </div>
      {hidden > 0 && (
        <div className="flex pt-4">
          <Button variant="outline" size="sm" onClick={() => setOpen((was) => !was)}>
            {open ? "See fewer" : `See more (${fmtNumber(hidden)})`}
          </Button>
        </div>
      )}
    </PreviewFrame>
  )
}
