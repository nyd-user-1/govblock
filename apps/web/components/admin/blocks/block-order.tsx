"use client"

import * as React from "react"
import { ArrowDown, ArrowUp } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"

// A dashboard page's blocks, in the order its reader wants (Brendan,
// 2026-09-20): every block is one full-width row, so moving one is an up or a
// down. The arrows show at a block's top right corner while the pointer is on
// it, and the order is kept per page in this browser. The blocks are reordered
// with CSS `order`, not remounted, so a chart keeps its state when it moves.

const OrderContext = React.createContext<{ order: string[]; move: (id: string, by: number) => void } | null>(null)

export function BlockOrder({ page, initial, children }: { page: string; /** Every block's id, in the page's own order. */ initial: string[]; children: React.ReactNode }) {
  const [order, setOrder] = React.useState(initial)
  const key = `block-order:${page}`
  React.useEffect(() => {
    try {
      const kept = JSON.parse(window.localStorage.getItem(key) ?? "null") as unknown
      // A kept order is used only while it names exactly the blocks the page has.
      if (Array.isArray(kept) && kept.length === initial.length && initial.every((id) => kept.includes(id))) setOrder(kept as string[])
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const move = React.useCallback(
    (id: string, by: number) =>
      setOrder((current) => {
        const from = current.indexOf(id)
        const to = from + by
        if (from < 0 || to < 0 || to >= current.length) return current
        const next = [...current]
        ;[next[from], next[to]] = [next[to], next[from]]
        try {
          window.localStorage.setItem(key, JSON.stringify(next))
        } catch {}
        return next
      }),
    [key]
  )
  const value = React.useMemo(() => ({ order, move }), [order, move])
  return (
    <OrderContext.Provider value={value}>
      <div className="flex flex-col">{children}</div>
    </OrderContext.Provider>
  )
}

export function OrderedBlock({ id, label, children }: { id: string; /** What the arrows say they move: "Volume". */ label: string; children: React.ReactNode }) {
  const ctx = React.useContext(OrderContext)
  const at = ctx ? ctx.order.indexOf(id) : 0
  const last = ctx ? ctx.order.length - 1 : 0
  const arrow = "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5"
  return (
    <div style={{ order: at }} className="group/block relative mt-4 sm:mt-5">
      {ctx && (
        <div className={cn("absolute -top-3 right-6 z-10 flex items-center gap-0.5 rounded-lg border bg-background p-0.5 opacity-0 shadow-xs transition-opacity", "group-hover/block:opacity-100 focus-within:opacity-100")}>
          <button type="button" aria-label={`Move ${label} up`} disabled={at <= 0} onClick={() => ctx.move(id, -1)} className={arrow}>
            <ArrowUp />
          </button>
          <button type="button" aria-label={`Move ${label} down`} disabled={at >= last} onClick={() => ctx.move(id, 1)} className={arrow}>
            <ArrowDown />
          </button>
        </div>
      )}
      {children}
    </div>
  )
}
