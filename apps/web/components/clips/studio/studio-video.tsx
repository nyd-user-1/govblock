import * as React from "react"
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { BillHistory } from "../templates/bill-history"
import { isDark, RollCallTally } from "../templates/roll-call-tally"
import { GovBlockMark } from "./mark"
import { paint, type Paint } from "./palette"
import { fill, sceneFrames, type Scene, type StudioData, type StudioSpec } from "./spec"

// A Studio template drawn: its scenes one after another, each entering by its
// transition (or the look's motion), its words filled from the pasted link's
// data, painted by the look. React and Remotion only, inline styles, like the
// built-in templates, so the Player and a render read it alike. The GovBlock
// mark sits in the corner of every scene and fills the end card.

export type StudioVideoProps = { spec: StudioSpec; data: StudioData | null }

const colorOf = (key: string, p: Paint) => (key === "yes" ? p.yes : key === "no" ? p.no : key === "accent" ? p.accent : p.ink)

const CLASSIC = { width: 1080, height: 1920 }

function Enter({ motion, children }: { motion: string; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
  const style: React.CSSProperties =
    motion === "none"
      ? {}
      : motion === "slide"
        ? { opacity: t, transform: `translateY(${(1 - t) * 60}px)` }
        : motion === "zoom"
          ? { opacity: t, transform: `scale(${0.9 + t * 0.1})` }
          : { opacity: t }
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>
}

/** A 1080×1920 template fitted into whatever shape the video is. */
function Fitted({ children }: { children: React.ReactNode }) {
  const { width, height } = useVideoConfig()
  const scale = Math.min(width / CLASSIC.width, height / CLASSIC.height)
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: CLASSIC.width, height: CLASSIC.height, transform: `scale(${scale})`, flexShrink: 0, position: "relative" }}>{children}</div>
    </AbsoluteFill>
  )
}

function Missing({ what, u }: { what: string; u: number }) {
  return <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontSize: 44 * u, opacity: 0.6, textAlign: "center", padding: 80 * u }}>{what}</AbsoluteFill>
}

/** Counts up to a figure that reads as a number; anything else shows as written. */
function useCount(raw: string, at = 0) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const target = Number(raw.replace(/[^\d.-]/g, ""))
  if (!raw.trim() || !Number.isFinite(target) || /[a-z]/i.test(raw.replace(/%$/, ""))) return raw
  const v = Math.round(interpolate(frame - at, [0, fps * 1.2], [0, target], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }))
  return `${v.toLocaleString("en-US")}${raw.trim().endsWith("%") ? "%" : ""}`
}

function Stat({ value, label, u, at, p, big }: { value: string; label: string; u: number; at: number; p: Paint; big: number }) {
  const frame = useCurrentFrame()
  const shown = useCount(value, at)
  const t = interpolate(frame - at, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 * u, opacity: t, transform: `translateY(${(1 - t) * 24 * u}px)` }}>
      <div style={{ fontFamily: p.heading, fontSize: big * u, fontWeight: 800, lineHeight: 1, color: p.accent, fontVariantNumeric: "tabular-nums" }}>{shown}</div>
      <div style={{ fontSize: 40 * u, opacity: 0.8 }}>{label}</div>
    </div>
  )
}

function SceneBody({ scene, spec, data, p }: { scene: Scene; spec: StudioSpec; data: StudioData | null; p: Paint }) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const u = Math.min(width, height) / 1080
  const pad = 80 * u
  const text = (s: string) => fill(s, data)
  const seconds = sceneFrames(scene, spec) / fps
  const numberShown = useCount(scene.kind === "number" ? text(scene.value) : "")

  switch (scene.kind) {
    case "title":
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: scene.align === "center" ? "center" : "flex-start", textAlign: scene.align }}>
          {scene.eyebrow && <div style={{ fontSize: 34 * u, letterSpacing: 3 * u, textTransform: "uppercase", color: p.accent }}>{text(scene.eyebrow)}</div>}
          <div style={{ fontFamily: p.heading, fontSize: 140 * u, fontWeight: 700, lineHeight: 1.05, marginTop: 24 * u, letterSpacing: -2 * u }}>{text(scene.headline)}</div>
          {scene.subhead && <div style={{ fontSize: 50 * u, lineHeight: 1.25, marginTop: 28 * u, opacity: 0.85, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{text(scene.subhead)}</div>}
        </AbsoluteFill>
      )
    case "portrait": {
      const src = text(scene.image)
      const name = text(scene.name)
      const size = 520 * u
      const grow = spring({ frame, fps, config: { damping: 16, stiffness: 120 } })
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: "center", textAlign: "center", gap: 48 * u }}>
          <div style={{ width: size, height: size, borderRadius: Math.min(size / 2, p.radius * 4 * u), overflow: "hidden", background: p.muted, transform: `scale(${0.85 + grow * 0.15})`, display: "flex", alignItems: "center", justifyContent: "center", border: `${8 * u}px solid ${p.accent}` }}>
            {src ? (
              <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontFamily: p.heading, fontSize: 200 * u, fontWeight: 700 }}>{name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}</span>
            )}
          </div>
          <div style={{ fontFamily: p.heading, fontSize: 110 * u, fontWeight: 700, lineHeight: 1.05 }}>{name}</div>
          {scene.detail && <div style={{ fontSize: 48 * u, opacity: 0.8 }}>{text(scene.detail)}</div>}
        </AbsoluteFill>
      )
    }
    case "number":
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontFamily: p.heading, fontSize: 300 * u, fontWeight: 800, lineHeight: 1, color: colorOf(scene.color, p), fontVariantNumeric: "tabular-nums" }}>{numberShown}</div>
          <div style={{ fontSize: 56 * u, marginTop: 24 * u, opacity: 0.8 }}>{text(scene.label)}</div>
        </AbsoluteFill>
      )
    case "stats": {
      const items = scene.items.filter((i) => i.value || i.label)
      const tall = height > width
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: tall ? "flex-start" : "center" }}>
          <div style={{ display: "flex", flexDirection: tall ? "column" : "row", gap: (tall ? 72 : 96) * u }}>
            {items.map((item, i) => (
              <Stat key={i} value={text(item.value)} label={text(item.label)} u={u} at={i * 12} p={p} big={tall ? 180 : 150} />
            ))}
          </div>
        </AbsoluteFill>
      )
    }
    case "tally": {
      const yes = Number(text(scene.yes).replace(/[^\d]/g, "")) || 0
      const no = Number(text(scene.no).replace(/[^\d]/g, "")) || 0
      const other = Number(text(scene.other).replace(/[^\d]/g, "")) || 0
      const total = Math.max(1, yes + no + other)
      const lit = interpolate(frame, [fps * 0.3, fps * Math.max(1, seconds - 1.5)], [0, total], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      const columns = total > 150 ? 25 : total > 60 ? 15 : 10
      const gridW = width - pad * 2
      const cell = gridW / columns
      const stampAt = fps * Math.max(1, seconds - 1.2)
      const stamp = spring({ frame: frame - stampAt, fps, config: { damping: 12, stiffness: 140 } })
      const stampText = text(scene.stamp)
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center" }}>
          {scene.grid && (
            <div style={{ position: "relative", width: gridW, height: Math.ceil(total / columns) * cell }}>
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} style={{ position: "absolute", left: (i % columns) * cell, top: Math.floor(i / columns) * cell, width: cell * 0.78, height: cell * 0.78, borderRadius: Math.min(p.radius * u, cell * 0.39), background: i < lit ? (i < yes ? p.yes : i < yes + no ? p.no : `${p.ink}66`) : p.muted }} />
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 48 * u, marginTop: 48 * u, fontVariantNumeric: "tabular-nums", fontFamily: p.heading }}>
            <span style={{ fontSize: 130 * u, fontWeight: 700, color: p.yes }}>{Math.round(Math.min(lit, yes))}</span>
            <span style={{ fontSize: 130 * u, fontWeight: 700, color: p.no }}>{Math.round(Math.min(Math.max(lit - yes, 0), no))}</span>
            {other > 0 && <span style={{ fontSize: 70 * u, fontWeight: 700, opacity: 0.6, alignSelf: "flex-end" }}>{Math.round(Math.max(lit - yes - no, 0))}</span>}
          </div>
          {stampText && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ opacity: frame < stampAt ? 0 : 1, transform: `scale(${interpolate(stamp, [0, 1], [1.6, 1])}) rotate(-6deg)`, fontFamily: p.heading, fontSize: 120 * u, fontWeight: 800, letterSpacing: 6 * u, textTransform: "uppercase", padding: `${16 * u}px ${44 * u}px`, borderRadius: p.radius * 2 * u, border: `${10 * u}px solid ${p.accent}`, color: p.accent, background: p.background }}>
                {stampText}
              </div>
            </div>
          )}
        </AbsoluteFill>
      )
    }
    case "timeline": {
      const items = (data?.lists.timeline ?? []).slice(-Math.max(1, scene.max))
      if (!items.length) return <Missing what="This link has no timeline." u={u} />
      const step = Math.max(6, Math.floor((fps * Math.max(1, seconds - 1)) / items.length))
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", gap: 36 * u }}>
          {items.map((m, i) => {
            const at = i * step
            const t = interpolate(frame, [at, at + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            return (
              <div key={i} style={{ display: "flex", gap: 32 * u, opacity: t, transform: `translateX(${(1 - t) * 40 * u}px)` }}>
                <div style={{ width: 28 * u, height: 28 * u, marginTop: 10 * u, borderRadius: Math.min(14 * u, p.radius * u * 1.4), background: i === items.length - 1 ? p.accent : p.ink, flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 * u, minWidth: 0 }}>
                  {scene.dates && (m.date || m.chamber) && (
                    <div style={{ fontSize: 26 * u, letterSpacing: 2 * u, textTransform: "uppercase", opacity: 0.6 }}>
                      {m.date}
                      {m.date && m.chamber ? " · " : ""}
                      {m.chamber ?? ""}
                    </div>
                  )}
                  <div style={{ fontSize: 36 * u, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.action}</div>
                </div>
              </div>
            )
          })}
        </AbsoluteFill>
      )
    }
    case "bars": {
      const rows = data?.lists.bars ?? []
      if (!rows.length) return <Missing what="This link has no breakdown." u={u} />
      const max = Math.max(1, ...rows.map((r) => r.yes + (r.no ?? 0)))
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", gap: 36 * u }}>
          {scene.title && <div style={{ fontFamily: p.heading, fontSize: 64 * u, fontWeight: 700, marginBottom: 12 * u }}>{text(scene.title)}</div>}
          {rows.map((r, i) => {
            const grow = interpolate(frame - i * 6, [0, fps * 1.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
            const two = r.no !== undefined
            return (
              <div key={`${r.label}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 12 * u }}>
                <div style={{ fontSize: 36 * u, display: "flex", gap: 16 * u, fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ opacity: 0.9 }}>{r.label}</span>
                  <span style={{ color: two ? p.yes : p.accent }}>{r.yes.toLocaleString("en-US")}</span>
                  {two && <span style={{ color: p.no }}>{(r.no ?? 0).toLocaleString("en-US")}</span>}
                </div>
                <div style={{ display: "flex", height: 44 * u, width: `${((r.yes + (r.no ?? 0)) / max) * 100 * grow}%`, borderRadius: p.radius * u, overflow: "hidden" }}>
                  <div style={{ flex: r.yes, background: two ? p.yes : p.accent }} />
                  {two && <div style={{ flex: r.no ?? 0, background: p.no }} />}
                </div>
              </div>
            )
          })}
        </AbsoluteFill>
      )
    }
    case "text":
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", textAlign: scene.align, alignItems: scene.align === "center" ? "center" : "flex-start" }}>
          <div style={{ fontSize: scene.size * u, lineHeight: 1.3, whiteSpace: "pre-wrap" }}>{text(scene.body)}</div>
        </AbsoluteFill>
      )
    case "end":
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: "center", textAlign: "center", gap: 40 * u }}>
          <GovBlockMark size={260 * u} dark={isDark(p.background)} />
          {scene.tagline && <div style={{ fontFamily: p.heading, fontSize: 60 * u, fontWeight: 600, maxWidth: width * 0.8 }}>{text(scene.tagline)}</div>}
        </AbsoluteFill>
      )
    case "roll-call-tally":
      return data?.raw?.tally ? (
        <Fitted>
          <RollCallTally {...data.raw.tally} paint={p} />
        </Fitted>
      ) : (
        <Missing what="Paste a roll call link." u={u} />
      )
    case "bill-history":
      return data?.raw?.history ? (
        <Fitted>
          <BillHistory {...data.raw.history} paint={p} />
        </Fitted>
      ) : (
        <Missing what="Paste a bill link." u={u} />
      )
  }
}

/** Scenes that carry the mark themselves. */
const OWN_MARK = new Set(["end", "roll-call-tally", "bill-history"])

export function StudioVideo({ spec, data }: StudioVideoProps) {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const u = Math.min(width, height) / 1080
  const p = paint(spec.look)
  let from = 0
  let marked = true
  const scenes = spec.scenes.map((scene) => {
    const frames = sceneFrames(scene, spec)
    const at = from
    from += frames
    if (frame >= at && frame < at + frames && OWN_MARK.has(scene.kind)) marked = false
    return { scene, at, frames }
  })
  return (
    <AbsoluteFill style={{ background: p.background, color: p.ink, fontFamily: p.font }}>
      {scenes.map(({ scene, at, frames }) => (
        <Sequence key={scene.id} from={at} durationInFrames={frames}>
          <Enter motion={scene.transition === "look" ? spec.look.motion : scene.transition}>
            <SceneBody scene={scene} spec={spec} data={data} p={p} />
          </Enter>
        </Sequence>
      ))}
      {marked && (
        <div style={{ position: "absolute", right: 64 * u, bottom: 56 * u }}>
          <GovBlockMark size={64 * u} dark={isDark(p.background)} />
        </div>
      )}
    </AbsoluteFill>
  )
}
