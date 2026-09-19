"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"

// /sources' two limits (Brendan, 2026-09-18): a section shows three rows of
// cards (3x3) until Show more opens the rest — two rows when it has too few
// for a third full one — and a card shows two rows of tags, the last of them
// "More" when the rest will not fit, so every card is one size.

/** How many cards show folded, `cols` across: three full rows, or two when a third would be short, or all when there is nothing more to open. */
export function folded(count: number, cols: number) {
  if (count > 3 * cols) return 3 * cols
  if (count === 3 * cols) return count
  if (count > 2 * cols) return 2 * cols
  return count
}

function useColumns() {
  const [cols, setCols] = React.useState(3)
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)")
    const update = () => setCols(query.matches ? 3 : 2)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return cols
}

export function GalleryGrid({ heading, children }: { heading: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const cards = React.Children.toArray(children)
  const limit = folded(cards.length, useColumns())
  const more = limit < cards.length
  return (
    <section className="mt-12 first:mt-0">
      {heading}
      <div className="not-typeset mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{open ? cards : cards.slice(0, limit)}</div>
      {more && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="not-typeset mt-3 flex w-full items-center justify-center gap-1 rounded-xl border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {open ? "Show less" : `Show ${cards.length - limit} more`}
          <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </section>
  )
}

const CHIP = "h-5 max-w-full truncate rounded-md border px-1.5 text-[11px] leading-[18px] text-muted-foreground"

/** The tags that fit in two rows; "More" takes the last place when some do not. */
export function SourceTags({ items }: { items: string[] }) {
  const box = React.useRef<HTMLDivElement>(null)
  const [shown, setShown] = React.useState(items.length)

  // Start from every tag whenever the card's width changes, then drop one at a
  // time until the last chip (the tag, or "More") sits in the second row.
  React.useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setShown(items.length))
    observer.observe(el)
    return () => observer.disconnect()
  }, [items.length])

  React.useLayoutEffect(() => {
    const el = box.current
    const last = el?.lastElementChild as HTMLElement | null
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !last || !first || shown <= 0) return
    const rowStep = first.offsetHeight + 6
    if (last.offsetTop - first.offsetTop >= rowStep * 2) setShown((n) => n - 1)
  }, [shown])

  const rest = items.slice(shown)
  return (
    <div ref={box} className="mt-auto flex h-[46px] flex-wrap content-start gap-1.5 overflow-hidden">
      {items.slice(0, shown).map((item) => (
        <span key={item} className={CHIP}>
          {item}
        </span>
      ))}
      {rest.length > 0 && (
        <span className={cn(CHIP, "text-foreground")} title={rest.join(", ")}>
          More
        </span>
      )}
    </div>
  )
}
