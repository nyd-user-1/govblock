import * as React from "react"
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { GovBlockMark } from "../studio/mark"
import type { Paint } from "../studio/palette"

// A roll call as a tally: the first generated clip (brief 2026-09-14). Every
// word on it is the vote row's own — the chamber, the roll number, the date,
// the bill, the question, the counts, the result — and nothing is written
// about the vote. A seat per member lights up yea, then nay, then present,
// then not voting, the counters run beside it, the parties follow, and the
// result lands last.
//
// Self-contained on purpose: React and Remotion only, inline styles, no app
// imports beyond its studio neighbours. The same file is previewed by <Player> in /clips and bundled by
// scripts/clips/render on the worker box, where neither Tailwind nor the
// app's path aliases exist.

export type RollCallTallyProps = {
  chamber: "house" | "senate"
  congress: number
  session: number
  roll: number
  date: string | null
  citation: string | null
  billTitle: string | null
  question: string | null
  result: string | null
  counts: { yea: number; nay: number; present: number; notVoting: number }
  parties: { party: string; yea: number; nay: number; present: number; notVoting: number }[]
  fontFamily?: string
  /** Studio's colours, faces and corners; absent, the template's own dark look. */
  paint?: Paint
}

export const ROLL_CALL_TALLY = { id: "roll-call-tally", fps: 30, durationInFrames: 450, width: 1080, height: 1920 } as const

const OWN = { ink: "#fafafa", paper: "#0b0b0c", yea: "#22c55e", nay: "#ef4444" }
const LABELS = { yea: "Yea", nay: "Nay", present: "Present", notVoting: "Not voting" } as const
const KINDS = ["yea", "nay", "present", "notVoting"] as const

const PARTY_NAMES: Record<string, string> = { R: "Republicans", D: "Democrats", I: "Independents", ID: "Independents" }

/** Whether a hex colour is dark, for the mark's tint. */
export const isDark = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return true
  const n = parseInt(m[1], 16)
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 140
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "")

export function RollCallTally({ chamber, roll, date, citation, billTitle, question, result, counts, parties, fontFamily, paint }: RollCallTallyProps) {
  const INK = paint?.ink ?? OWN.ink
  const PAPER = paint?.background ?? OWN.paper
  const COLORS = { yea: paint?.yes ?? OWN.yea, nay: paint?.no ?? OWN.nay, present: "#f59e0b", notVoting: "#3f3f46" }
  const dark = !paint || isDark(PAPER)
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const total = counts.yea + counts.nay + counts.present + counts.notVoting

  // 0–1.5 s the heading; 1.5–7.5 s the seats; 8 s the parties; 11 s the result.
  const lit = interpolate(frame, [45, 225], [0, total], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) })
  const shown = {
    yea: Math.round(Math.min(lit, counts.yea)),
    nay: Math.round(Math.min(Math.max(lit - counts.yea, 0), counts.nay)),
    present: Math.round(Math.min(Math.max(lit - counts.yea - counts.nay, 0), counts.present)),
    notVoting: Math.round(Math.min(Math.max(lit - counts.yea - counts.nay - counts.present, 0), counts.notVoting)),
  }
  const fade = (from: number, length = 15) => interpolate(frame, [from, from + length], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const rise = (from: number) => interpolate(frame, [from, from + 20], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
  const stamp = spring({ frame: frame - 330, fps, config: { damping: 12, stiffness: 140 } })

  // The seats: a grid sized to the chamber, filled in the clerk's order.
  const columns = chamber === "senate" ? 10 : 25
  const gridWidth = 920
  const cell = gridWidth / columns
  const seat = cell * 0.78
  const order: (typeof KINDS)[number][] = KINDS.flatMap((k) => Array.from({ length: counts[k] }, () => k))
  const rows = Math.ceil(total / columns)
  const chamberName = chamber === "senate" ? "Senate" : "House"
  const passed = result ? /pass|agree|confirm|adopt/i.test(result) : null

  return (
    <AbsoluteFill style={{ background: PAPER, color: INK, fontFamily: fontFamily ?? paint?.font ?? "var(--font-sans), Geist, system-ui, sans-serif", padding: 80 }}>
      <div style={{ opacity: fade(0), transform: `translateY(${rise(0)}px)` }}>
        <div style={{ fontSize: 32, letterSpacing: 3, textTransform: "uppercase", opacity: 0.6 }}>
          {chamberName} roll call {roll}
          {date ? ` · ${fmtDate(date)}` : ""}
        </div>
        {citation && <div style={{ fontSize: 132, fontWeight: 700, lineHeight: 1.05, marginTop: 28, letterSpacing: -2 }}>{citation}</div>}
        {billTitle && (
          <div style={{ fontSize: 44, lineHeight: 1.25, marginTop: 20, opacity: 0.85, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{billTitle}</div>
        )}
      </div>
      {question && (
        <div style={{ opacity: fade(20), transform: `translateY(${rise(20)}px)`, marginTop: 36, alignSelf: "flex-start", fontSize: 38, padding: "12px 26px", borderRadius: 999, border: `2px solid ${INK}59` }}>
          {question}
        </div>
      )}

      <div style={{ position: "relative", marginTop: 56, width: gridWidth, height: rows * cell }}>
        {order.map((kind, i) => {
          const on = i < lit
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (i % columns) * cell,
                top: Math.floor(i / columns) * cell,
                width: seat,
                height: seat,
                borderRadius: chamber === "senate" ? seat / 2 : (paint?.radius ?? 6),
                background: on ? COLORS[kind] : `${INK}14`,
              }}
            />
          )
        })}
        {result && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div
              style={{
                opacity: frame < 330 ? 0 : 1,
                transform: `scale(${interpolate(stamp, [0, 1], [1.6, 1])}) rotate(-6deg)`,
                fontSize: 128,
                fontWeight: 800,
                letterSpacing: 6,
                textTransform: "uppercase",
                padding: "18px 48px",
                borderRadius: 24,
                border: `10px solid ${passed === false ? COLORS.nay : passed ? COLORS.yea : INK}`,
                color: passed === false ? COLORS.nay : passed ? COLORS.yea : INK,
                background: `${PAPER}e0`,
              }}
            >
              {result}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 40, marginTop: 44 }}>
        {KINDS.filter((k) => counts[k] > 0 || k === "yea" || k === "nay").map((k) => (
          <div key={k} style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: k === "yea" || k === "nay" ? 112 : 64, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1, color: k === "notVoting" ? `${INK}99` : COLORS[k] }}>{shown[k]}</span>
            <span style={{ fontSize: 30, opacity: 0.7, marginTop: 8 }}>{LABELS[k]}</span>
          </div>
        ))}
      </div>

      <div style={{ opacity: fade(240), transform: `translateY(${rise(240)}px)`, marginTop: 40, display: "flex", flexDirection: "column", gap: 10 }}>
        {parties.map((p) => (
          <div key={p.party} style={{ fontSize: 34, display: "flex", gap: 18, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ width: 280, opacity: 0.85 }}>{PARTY_NAMES[p.party] ?? p.party}</span>
            <span style={{ color: COLORS.yea }}>{p.yea} yea</span>
            <span style={{ color: COLORS.nay }}>{p.nay} nay</span>
            {p.present > 0 && <span style={{ color: COLORS.present }}>{p.present} present</span>}
            {p.notVoting > 0 && <span style={{ opacity: 0.55 }}>{p.notVoting} not voting</span>}
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", right: 80, bottom: 64 }}>
        <GovBlockMark size={64} dark={dark} />
      </div>
    </AbsoluteFill>
  )
}
