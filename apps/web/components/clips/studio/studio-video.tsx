import * as React from "react"
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { fill, type Scene, type StudioData, type StudioSpec, type Theme } from "./spec"

// A Studio template drawn: its scenes one after another, each entering by its
// transition, its words filled from the pasted link's data. React and Remotion
// only, inline styles, like the built-in templates, so the Player and a
// render read it alike.

export type StudioVideoProps = { spec: StudioSpec; data: StudioData | null }

const FONTS: Record<Theme["font"], string> = {
  sans: "var(--font-sans), Geist, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "var(--font-mono), 'Geist Mono', ui-monospace, monospace",
}

const colorOf = (key: string, theme: Theme) => (key === "yes" ? theme.yes : key === "no" ? theme.no : key === "accent" ? theme.accent : key === "ink" ? theme.ink : key)

function Enter({ scene, children }: { scene: Scene; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
  const style: React.CSSProperties =
    scene.transition === "none"
      ? {}
      : scene.transition === "slide"
        ? { opacity: t, transform: `translateY(${(1 - t) * 60}px)` }
        : scene.transition === "zoom"
          ? { opacity: t, transform: `scale(${0.9 + t * 0.1})` }
          : { opacity: t }
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>
}

function SceneBody({ scene, spec, data }: { scene: Scene; spec: StudioSpec; data: StudioData | null }) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const u = Math.min(width, height) / 1080
  const { theme } = spec
  const pad = 80 * u
  const text = (s: string) => fill(s, data)

  switch (scene.kind) {
    case "title":
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: scene.align === "center" ? "center" : "flex-start", textAlign: scene.align }}>
          {scene.eyebrow && <div style={{ fontSize: 34 * u, letterSpacing: 3 * u, textTransform: "uppercase", opacity: 0.6 }}>{text(scene.eyebrow)}</div>}
          <div style={{ fontSize: 140 * u, fontWeight: 700, lineHeight: 1.05, marginTop: 24 * u, letterSpacing: -2 * u }}>{text(scene.headline)}</div>
          {scene.subhead && <div style={{ fontSize: 50 * u, lineHeight: 1.25, marginTop: 28 * u, opacity: 0.85 }}>{text(scene.subhead)}</div>}
        </AbsoluteFill>
      )
    case "number": {
      const raw = text(scene.value)
      const target = Number(raw.replace(/[^\d.-]/g, ""))
      const shown = Number.isFinite(target) && raw.trim() !== "" ? Math.round(interpolate(frame, [0, fps * 1.2], [0, target], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })).toLocaleString("en-US") : raw
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: 300 * u, fontWeight: 800, lineHeight: 1, color: colorOf(scene.color, theme), fontVariantNumeric: "tabular-nums" }}>{shown}</div>
          <div style={{ fontSize: 56 * u, marginTop: 24 * u, opacity: 0.8 }}>{text(scene.label)}</div>
        </AbsoluteFill>
      )
    }
    case "tally": {
      const yes = Number(text(scene.yes)) || 0
      const no = Number(text(scene.no)) || 0
      const other = Number(text(scene.other)) || 0
      const total = Math.max(1, yes + no + other)
      const lit = interpolate(frame, [fps * 0.3, fps * Math.max(1, scene.seconds - 1.5)], [0, total], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      const columns = total > 150 ? 25 : total > 60 ? 15 : 10
      const gridW = width - pad * 2
      const cell = gridW / columns
      const stampAt = fps * Math.max(1, scene.seconds - 1.2)
      const stamp = spring({ frame: frame - stampAt, fps, config: { damping: 12, stiffness: 140 } })
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center" }}>
          {scene.grid && (
            <div style={{ position: "relative", width: gridW, height: Math.ceil(total / columns) * cell }}>
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} style={{ position: "absolute", left: (i % columns) * cell, top: Math.floor(i / columns) * cell, width: cell * 0.78, height: cell * 0.78, borderRadius: 6 * u, background: i < lit ? (i < yes ? theme.yes : i < yes + no ? theme.no : "rgba(127,127,127,0.5)") : "rgba(127,127,127,0.15)" }} />
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 48 * u, marginTop: 48 * u, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontSize: 130 * u, fontWeight: 700, color: theme.yes }}>{Math.round(Math.min(lit, yes))}</span>
            <span style={{ fontSize: 130 * u, fontWeight: 700, color: theme.no }}>{Math.round(Math.min(Math.max(lit - yes, 0), no))}</span>
            {other > 0 && <span style={{ fontSize: 70 * u, fontWeight: 700, opacity: 0.6, alignSelf: "flex-end" }}>{Math.round(Math.max(lit - yes - no, 0))}</span>}
          </div>
          {scene.stamp && text(scene.stamp) && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ opacity: frame < stampAt ? 0 : 1, transform: `scale(${interpolate(stamp, [0, 1], [1.6, 1])}) rotate(-6deg)`, fontSize: 120 * u, fontWeight: 800, letterSpacing: 6 * u, textTransform: "uppercase", padding: `${16 * u}px ${44 * u}px`, borderRadius: 24 * u, border: `${10 * u}px solid ${theme.accent}`, color: theme.accent, background: theme.background }}>
                {text(scene.stamp)}
              </div>
            </div>
          )}
        </AbsoluteFill>
      )
    }
    case "timeline": {
      const items = (data?.lists.milestones ?? []).slice(-Math.max(1, scene.max))
      const step = Math.max(6, Math.floor((fps * Math.max(1, scene.seconds - 1)) / Math.max(1, items.length)))
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", gap: 36 * u }}>
          {items.length === 0 && <div style={{ fontSize: 44 * u, opacity: 0.6 }}>This link has no timeline.</div>}
          {items.map((m, i) => {
            const at = i * step
            const t = interpolate(frame, [at, at + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            return (
              <div key={i} style={{ display: "flex", gap: 32 * u, opacity: t, transform: `translateX(${(1 - t) * 40 * u}px)` }}>
                <div style={{ width: 28 * u, height: 28 * u, marginTop: 10 * u, borderRadius: 999, background: i === items.length - 1 ? theme.accent : theme.ink, flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 * u, minWidth: 0 }}>
                  {scene.dates && (
                    <div style={{ fontSize: 26 * u, letterSpacing: 2 * u, textTransform: "uppercase", opacity: 0.6 }}>
                      {m.date}
                      {m.chamber ? ` · ${m.chamber}` : ""}
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
      const rows = data?.lists.parties ?? []
      const max = Math.max(1, ...rows.map((r) => r.yes + r.no))
      const grow = interpolate(frame, [0, fps * 1.2], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
      return (
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", gap: 40 * u }}>
          {scene.title && <div style={{ fontSize: 60 * u, fontWeight: 700 }}>{text(scene.title)}</div>}
          {rows.length === 0 && <div style={{ fontSize: 44 * u, opacity: 0.6 }}>This link has no breakdown.</div>}
          {rows.map((r) => (
            <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: 12 * u }}>
              <div style={{ fontSize: 36 * u }}>
                {r.label} <span style={{ color: theme.yes }}>{r.yes}</span> · <span style={{ color: theme.no }}>{r.no}</span>
              </div>
              <div style={{ display: "flex", height: 44 * u, width: `${((r.yes + r.no) / max) * 100 * grow}%`, borderRadius: 10 * u, overflow: "hidden" }}>
                <div style={{ flex: r.yes, background: theme.yes }} />
                <div style={{ flex: r.no, background: theme.no }} />
              </div>
            </div>
          ))}
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
        <AbsoluteFill style={{ padding: pad, justifyContent: "center", alignItems: "center", textAlign: "center", gap: 24 * u }}>
          <div style={{ fontSize: 110 * u, fontWeight: 800, letterSpacing: 2 * u, color: theme.accent }}>{text(scene.brand)}</div>
          {scene.source && <div style={{ fontSize: 34 * u, opacity: 0.6 }}>{text(scene.source)}</div>}
        </AbsoluteFill>
      )
  }
}

export function StudioVideo({ spec, data }: StudioVideoProps) {
  let from = 0
  return (
    <AbsoluteFill style={{ background: spec.theme.background, color: spec.theme.ink, fontFamily: FONTS[spec.theme.font] }}>
      {spec.scenes.map((scene) => {
        const frames = Math.round(Math.max(0.5, scene.seconds) * spec.fps)
        const at = from
        from += frames
        return (
          <Sequence key={scene.id} from={at} durationInFrames={frames}>
            <Enter scene={scene}>
              <SceneBody scene={scene} spec={spec} data={data} />
            </Enter>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
