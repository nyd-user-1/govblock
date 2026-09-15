import * as React from "react"
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion"

// The GovBlock mark in a video (Brendan, 2026-09-14: "replace it with the
// animated govblock icon"): components/logo-mark.tsx's Blocks, the L in the
// flag's blue and the small block in its red, drawn by frame so a render moves
// exactly as the preview does. The block lifts out and settles back every two
// seconds. On a dark page the blue is lifted so the L still reads.

export function GovBlockMark({ size, dark = true, delay = 0 }: { size: number; dark?: boolean; delay?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const period = fps * 2
  const t = ((frame - delay) % period + period) % period
  const lift = interpolate(t, [0, period * 0.2, period * 0.45, period], [0, 1, 0, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const eased = lift * lift * (3 - 2 * lift)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 22V6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-6H2" transform="translate(2 -2)" stroke={dark ? "#6f9bd8" : "#0a3161"} strokeLinejoin="miter" />
      <path d="M15 2 H21 A1 1 0 0 1 22 3 V9 A1 1 0 0 1 21 10 H15 A1 1 0 0 1 14 9 V3 A1 1 0 0 1 15 2 Z" transform={`translate(${-2 + 2 * eased} ${2 - 2 * eased})`} stroke={dark ? "#e0556f" : "#b31942"} />
    </svg>
  )
}
