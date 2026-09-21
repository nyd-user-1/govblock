"use client"

import * as React from "react"

import { CONGRESS, flagUrl, STATE_CODES } from "@/lib/filters"

// The loader (Brendan, 2026-09-13): the fifty state flags and the District's,
// shuffled, one every 70ms, in the place the flag is about to take. All of
// them are in the tree at once so every image is fetched before the first
// swap and none of the swaps shows a blank.
//
// The flag of the United States leads (Brendan, 2026-09-21): it is the first
// flag every time, before and after the shuffle, where Alabama's used to be —
// the alphabet's accident, and the only flag a short wait ever showed.
const STATES = [...STATE_CODES, "DC"]
const CODES = [CONGRESS, ...STATES]

function shuffled<T>(xs: T[]) {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function FlagLoader({ width = 96, className }: { width?: number; className?: string }) {
  // The server and the first client render agree on the alphabetical order;
  // the shuffle lands after mount, so hydration has nothing to dispute.
  const [order, setOrder] = React.useState(CODES)
  const [i, setI] = React.useState(0)
  React.useEffect(() => {
    setOrder([CONGRESS, ...shuffled(STATES)])
    const id = window.setInterval(() => setI((n) => (n + 1) % CODES.length), 70)
    return () => window.clearInterval(id)
  }, [])
  const height = Math.round((width * 2) / 3)
  return (
    <span role="status" aria-label="Loading" className={className} style={{ display: "inline-block", verticalAlign: "middle", width, height, position: "relative" }}>
      {order.map((code, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={code} src={flagUrl(code)} alt="" width={width} height={height} decoding="async" className="absolute inset-0 rounded-[4px] object-cover ring-1 ring-foreground/10" style={{ width, height, visibility: n === i ? "visible" : "hidden" }} />
      ))}
    </span>
  )
}
