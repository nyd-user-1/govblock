"use client"

import * as React from "react"

import { PARTY_COLORS } from "@/lib/map/palette"
import { orderSeats, type Party, type SimSeat } from "@/lib/elections/seats"

// A chamber's seats in a half ring, one dot each, blue from the left and red
// from the right with the closest races at the seam. Packed like a real
// chamber: the dots are as far apart along a row as the rows are from each
// other, so the ring reads as arcs, never as spokes. Solid seats were
// decided in the general election; pale ones were won by 20 points or more,
// fainter still with no opponent — settled in the primary. A seat the rule
// flipped wears a ring.

const COLOR: Record<Party, string> = { D: PARTY_COLORS.D, R: PARTY_COLORS.R, I: PARTY_COLORS.I, O: "#9ca3af" }

function layout(n: number) {
  const dot = n <= 40 ? 13 : n <= 100 ? 9.5 : n <= 160 ? 8.5 : n <= 300 ? 7 : 5.6
  const s = dot * 2.35
  const rows = Math.max(2, Math.round((1 + Math.sqrt(1 + 1.09 * n)) / 2))
  let r0 = (n * s) / (Math.PI * rows) - ((rows - 1) * s) / 2
  if (r0 < s * 1.2) r0 = s * 1.2
  const radii = Array.from({ length: rows }, (_, i) => r0 + i * s)
  const rmax = radii[rows - 1]
  const sum = radii.reduce((a, b) => a + b, 0)
  const per = radii.map((r) => Math.floor((n * r) / sum))
  let left = n - per.reduce((a, b) => a + b, 0)
  for (let i = rows - 1; left > 0; i = (i - 1 + rows) % rows) {
    per[i]++
    left--
  }
  const slots: { row: number; a: number }[] = []
  per.forEach((k, row) => {
    for (let j = 0; j < k; j++) slots.push({ row, a: k === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (k - 1) })
  })
  slots.sort((p, q) => q.a - p.a || p.row - q.row)
  const W = 2 * rmax + 2 * dot + 8
  const cx = W / 2
  const cy = rmax + dot + 8
  return { pts: slots.map((x) => ({ x: cx + radii[x.row] * Math.cos(x.a), y: cy - radii[x.row] * Math.sin(x.a) })), dot, W, H: cy + dot + 2 }
}

export function Hemicycle({
  seats,
  plain,
  size = 940,
  selected,
  onHover,
  onSelect,
}: {
  seats: SimSeat[]
  /** Every seat solid: the chamber as it looks. */
  plain?: boolean
  size?: number
  selected?: string | null
  onHover?: (seat: SimSeat | null, e?: React.MouseEvent) => void
  onSelect?: (seat: SimSeat) => void
}) {
  const L = React.useMemo(() => layout(seats.length), [seats.length])
  const ordered = React.useMemo(() => orderSeats(seats), [seats])
  const width = Math.min(size, L.W * 2.4)
  return (
    <svg viewBox={`0 0 ${L.W} ${L.H}`} style={{ width, maxWidth: "100%", height: "auto", display: "block", margin: "0 auto", overflow: "visible" }} role="img" aria-label={`${seats.filter((s) => s.now === "D").length} Democrats, ${seats.filter((s) => s.now === "R").length} Republicans`}>
      {ordered.map((seat, i) => {
        const p = L.pts[i]
        const flip = seat.now !== seat.party
        const sel = selected === seat.id
        const op = plain ? 1 : seat.decided === "nobody" ? 0.14 : seat.decided === "primary" ? 0.32 : 1
        return (
          <g key={seat.id}>
            <circle
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r={L.dot}
              fill={COLOR[seat.now]}
              fillOpacity={op}
              style={{ cursor: "pointer", transition: "fill .25s, fill-opacity .25s" }}
              onMouseMove={(e) => onHover?.(seat, e)}
              onMouseLeave={() => onHover?.(null)}
              onClick={() => onSelect?.(seat)}
            />
            {(flip || sel) && <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={L.dot + 2.2} fill="none" stroke="currentColor" strokeWidth={sel ? 2.2 : 1.4} strokeDasharray={sel ? "2 1.5" : undefined} pointerEvents="none" />}
          </g>
        )
      })}
    </svg>
  )
}

/** The legend's dots, in the ring's own colours. */
export function Dot({ party, pale }: { party: Party; pale?: boolean }) {
  return <span className="inline-block size-2.5 rounded-full" style={{ background: COLOR[party], opacity: pale ? 0.32 : 1 }} />
}

export const SEAT_COLOR = COLOR
