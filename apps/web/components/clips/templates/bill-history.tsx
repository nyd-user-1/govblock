import * as React from "react"
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

// A bill's history as a twenty-second timeline: the second generated clip.
// Every word is the record's — the citation, the title, the sponsor, each
// milestone's date, chamber and action as the clerk wrote it, and the law's
// number when it became one. The milestones arrive one after another down a
// line that draws itself; the column rises to keep the newest in view; the
// law's number lands last.
//
// Self-contained like roll-call-tally.tsx: React and Remotion only, inline
// styles, so the Player in /clips and the render on the worker box read it
// alike.

export type BillHistoryProps = {
  citation: string
  title: string
  sponsor: string | null
  milestones: { date: string; chamber: string | null; action: string }[]
  /** "Public Law No: 119-101", "Chapter 123", when the bill became law. */
  law: string | null
  source: string
  fontFamily?: string
}

export const BILL_HISTORY = { id: "bill-history", fps: 30, durationInFrames: 600, width: 1080, height: 1920 } as const

const INK = "#fafafa"
const PAPER = "#0b0b0c"
const LAW = "#22c55e"
const LINE = "rgba(250,250,250,0.18)"
const CHAMBER: Record<string, string> = { house: "#60a5fa", assembly: "#60a5fa", senate: "#f472b6" }

const fmtDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

export function BillHistory({ citation, title, sponsor, milestones, law, source, fontFamily }: BillHistoryProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const count = Math.max(1, milestones.length)
  // A second for the heading, then a milestone about every 1.8 s (Brendan, 2026-09-14: "moves too slow"), the law half a second after the last.
  const first = 30
  const step = Math.min(55, Math.floor(420 / count))
  const shown = milestones.filter((_, i) => frame >= first + i * step).length
  const fade = (from: number, length = 15) => interpolate(frame, [from, from + length], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const rise = (from: number) => interpolate(frame, [from, from + 20], [28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })

  // Each milestone is given a fixed row; past four, the column rises so the newest stays in view.
  const ROW = 230
  // interpolate needs two points or more; a bill of one or two milestones never rises.
  const lift = count > 4 ? interpolate(frame, milestones.map((_, i) => first + i * step), milestones.map((_, i) => Math.max(0, i - 3) * ROW), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }) : 0
  const lawAt = first + count * step + 15
  const stamp = spring({ frame: frame - lawAt, fps, config: { damping: 12, stiffness: 140 } })

  return (
    <AbsoluteFill style={{ background: PAPER, color: INK, fontFamily: fontFamily ?? "var(--font-sans), Geist, system-ui, sans-serif", padding: 80 }}>
      <div style={{ opacity: fade(0), transform: `translateY(${rise(0)}px)` }}>
        <div style={{ fontSize: 132, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{citation}</div>
        <div style={{ fontSize: 44, lineHeight: 1.25, marginTop: 20, opacity: 0.85, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>
        {sponsor && <div style={{ fontSize: 32, marginTop: 20, opacity: 0.6 }}>Sponsor: {sponsor}</div>}
      </div>

      <div style={{ position: "relative", marginTop: 60, flex: 1, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${-lift}px)` }}>
          <div style={{ position: "absolute", left: 18, top: 24, width: 4, borderRadius: 2, background: LINE, height: Math.max(0, count - 1) * ROW }} />
          <div
            style={{
              position: "absolute",
              left: 18,
              top: 24,
              width: 4,
              borderRadius: 2,
              background: law && frame >= lawAt ? LAW : INK,
              height: interpolate(frame, [first, first + Math.max(1, count - 1) * step], [0, Math.max(0, count - 1) * ROW], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          />
          {milestones.map((m, i) => {
            const at = first + i * step
            const key = (m.chamber ?? "").toLowerCase()
            return (
              <div key={i} style={{ position: "absolute", top: i * ROW, left: 0, right: 0, display: "flex", gap: 44, opacity: fade(at, 12), transform: `translateX(${interpolate(frame, [at, at + 18], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}px)` }}>
                <div style={{ width: 40, height: 40, marginTop: 6, borderRadius: 20, flexShrink: 0, background: i < shown ? (i === count - 1 && law ? LAW : INK) : PAPER, border: `4px solid ${i === count - 1 && law ? LAW : INK}` }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 28, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7 }}>
                    <span>{fmtDate(m.date)}</span>
                    {m.chamber && <span style={{ color: CHAMBER[key] ?? INK, fontWeight: 700 }}>{m.chamber}</span>}
                  </div>
                  <div style={{ fontSize: 40, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.action}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {law && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 200, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div
            style={{
              opacity: frame < lawAt ? 0 : 1,
              transform: `scale(${interpolate(stamp, [0, 1], [1.6, 1])}) rotate(-5deg)`,
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: 3,
              textTransform: "uppercase",
              padding: "16px 44px",
              borderRadius: 24,
              border: `10px solid ${LAW}`,
              color: LAW,
              background: "rgba(11,11,12,0.92)",
              whiteSpace: "nowrap",
            }}
          >
            {law}
          </div>
        </div>
      )}

      <div style={{ position: "absolute", left: 80, right: 80, bottom: 64, display: "flex", justifyContent: "space-between", fontSize: 28, opacity: 0.55 }}>
        <span>Source: {source}</span>
        <span style={{ fontWeight: 700, letterSpacing: 1 }}>GovBlock</span>
      </div>
    </AbsoluteFill>
  )
}
