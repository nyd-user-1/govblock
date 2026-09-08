"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"
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
        className={cn(
          // The scroller is typeset's own `.typeset-scroll` div, not this one.
          // It carries `overflow-x: auto`, which makes it the sticky header's
          // nearest scrolling ancestor — so a header stuck to anything outside
          // it never froze at all (found 2026-09-08). Constrain that div and the
          // header sticks to the box it actually scrolls in.
          //
          // Shorter than the rows it holds in both states, so the list scrolls
          // whether or not See more has been pressed.
          "[&>.typeset-scroll]:max-h-[22rem] [&>.typeset-scroll]:overflow-y-auto [&>.typeset-scroll]:overscroll-contain",
          "data-[open=true]:[&>.typeset-scroll]:max-h-[38rem]",
          "data-[open=false]:[&_tbody_tr:nth-child(n+11)]:hidden",
          // The scrollbar belongs to the rows: its track starts a header's
          // height down, so it cannot run up beside the copy button. Drawn
          // rather than left to the browser, because typeset ships that div
          // with `scrollbar-none` and Chrome only honours a track margin once
          // some ::-webkit-scrollbar rule has claimed the scrollbar.
          "[&>.typeset-scroll]:[scrollbar-width:thin]",
          "[&_.typeset-scroll::-webkit-scrollbar]:w-1.5",
          "[&_.typeset-scroll::-webkit-scrollbar-track]:mt-(--thead-h)",
          "[&_.typeset-scroll::-webkit-scrollbar-track]:bg-transparent",
          "[&_.typeset-scroll::-webkit-scrollbar-thumb]:rounded-full",
          "[&_.typeset-scroll::-webkit-scrollbar-thumb]:bg-border",
          // The frozen header. Sticky on the th rather than the thead, opaque so
          // rows pass behind it, and carrying the rule itself — typeset draws
          // that line as the first body row's top border, which scrolls away
          // with the row.
          "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-surface",
          "[&_thead_th]:border-b [&_thead_th]:border-(--typeset-rule)",
          "[&_tbody_tr:first-child_td]:border-t-0"
        )}
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
