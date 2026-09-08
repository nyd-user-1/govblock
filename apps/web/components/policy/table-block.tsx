"use client"

import * as React from "react"

import { fmtNumber } from "@/lib/format"
import { Button } from "@govblock/ui/components/nova/button"
import { CopyButton } from "@/components/copy-button"

// The surface block Brendan dropped over the tables (2026-09-08): the first ten
// rows, See more at the bottom left for the rest, and the list scrolls either
// way. Copy sits at the top right and appears on hover.
//
// The clipboard reads the rendered table rather than a second copy of the rows,
// so a server component can use this without shipping its rows twice.

const SHOWN = 10

/** The rendered table as TSV, which is what a spreadsheet wants on paste. */
function tableText(root: HTMLElement | null) {
  const table = root?.querySelector("table")
  if (!table) return ""
  return [...table.querySelectorAll("tr")]
    .map((row) => [...row.querySelectorAll("th,td")].map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim()).join("\t"))
    .filter((line) => line.replace(/\t/g, "").length)
    .join("\n")
}

export function TableBlock({ children, rows }: { children: React.ReactNode; rows: number }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const [text, setText] = React.useState("")
  const hidden = Math.max(0, rows - SHOWN)

  React.useEffect(() => setText(tableText(ref.current)), [open, children])

  // The header's own height, published to the scroller as --thead-h so the
  // scrollbar track can start below it. Measured rather than guessed: a header
  // wraps to two lines on a narrow column, and the number has to follow.
  React.useLayoutEffect(() => {
    const box = ref.current
    const head = box?.querySelector("thead")
    if (!box || !head) return
    const set = () => box.style.setProperty("--thead-h", `${head.getBoundingClientRect().height}px`)
    set()
    const watch = new ResizeObserver(set)
    watch.observe(head)
    return () => watch.disconnect()
  }, [children])

  return (
    <div className="group relative flex flex-col gap-2 rounded-2xl bg-surface p-6 text-sm text-surface-foreground">
      <CopyButton
        value={text}
        aria-label="Copy table"
        className="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      />
      <div
        ref={ref}
        data-open={open}
        // Shorter than the rows it holds in both states, so the list scrolls
        // whether or not See more has been pressed.
        //
        // The header row is frozen and the rows run under it: sticky on the th
        // rather than the thead, opaque so nothing shows through, and carrying
        // the rule itself — typeset draws that line as the first body row's top
        // border, which would have scrolled away with it. The scrollbar track is
        // inset by the header's height so it belongs to the rows.
        className="max-h-[22rem] overflow-y-auto overscroll-contain data-[open=true]:max-h-[38rem] data-[open=false]:[&_tbody_tr:nth-child(n+11)]:hidden [&::-webkit-scrollbar-track]:mt-(--thead-h) [&_tbody_tr:first-child_td]:border-t-0 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:border-b [&_thead_th]:border-(--typeset-rule) [&_thead_th]:bg-surface"
      >
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
