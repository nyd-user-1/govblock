"use client"

import * as React from "react"
import { Player, Thumbnail, type PlayerRef } from "@remotion/player"

import { BILL_HISTORY, BillHistory } from "./templates/bill-history"
import { ROLL_CALL_TALLY, RollCallTally } from "./templates/roll-call-tally"
import { durationInFrames, parseSpec, SIZES } from "./studio/spec"
import { StudioVideo } from "./studio/studio-video"

// A generated clip plays as what it is: a template and its data, drawn live
// by Remotion in the viewer's browser (Brendan, 2026-09-14: saving and sharing
// need no render machine). The feed and the grid load this module only when
// a generated clip is on screen.

export type Composition = { template: string; props: Record<string, unknown> }

type AnyComponent = React.ComponentType<Record<string, unknown>>

export const TEMPLATES: Record<string, { component: AnyComponent; spec: { fps: number; durationInFrames: number; width: number; height: number }; still: number }> = {
  [ROLL_CALL_TALLY.id]: { component: RollCallTally as unknown as AnyComponent, spec: ROLL_CALL_TALLY, still: 360 },
  [BILL_HISTORY.id]: { component: BillHistory as unknown as AnyComponent, spec: BILL_HISTORY, still: 560 },
}

/** A composition's component, props, size and length: fixed for a built-in template, read from the spec for a Studio one. A Studio clip posted in the first spec, before 2026-09-14's redesign, no longer reads and is left out. */
export function resolved(composition: Composition) {
  if (composition.template === "studio") {
    const spec = parseSpec((composition.props as { spec?: unknown }).spec)
    if (!spec) return null
    const frames = durationInFrames(spec)
    return { component: StudioVideo as unknown as AnyComponent, props: { ...composition.props, spec }, spec: { fps: spec.fps, durationInFrames: frames, ...SIZES[spec.aspect] }, still: Math.min(frames - 1, Math.round(frames * 0.4)) }
  }
  const t = TEMPLATES[composition.template]
  return t ? { ...t, props: composition.props } : null
}

/** The clip in the feed: plays while active, loops, and pauses on a click. */
export function CompositionPlayer({ composition, active, onPaused }: { composition: Composition; active: boolean; onPaused: (paused: boolean) => void }) {
  const ref = React.useRef<PlayerRef>(null)
  const t = resolved(composition)
  React.useEffect(() => {
    const p = ref.current
    if (!p) return
    if (active) {
      p.play()
      onPaused(false)
    } else {
      p.pause()
      p.seekTo(0)
    }
  }, [active, onPaused])
  if (!t) return <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">This template is no longer available.</div>
  return (
    <div
      className="absolute inset-0"
      onClick={() => {
        const p = ref.current
        if (!p) return
        if (p.isPlaying()) {
          p.pause()
          onPaused(true)
        } else {
          p.play()
          onPaused(false)
        }
      }}
    >
      <Player ref={ref} component={t.component} inputProps={t.props} durationInFrames={t.spec.durationInFrames} fps={t.spec.fps} compositionWidth={t.spec.width} compositionHeight={t.spec.height} style={{ width: "100%", height: "100%" }} loop />
    </div>
  )
}

/** The grid's tile: one frame of the clip, where its result stands. */
export function CompositionThumb({ composition }: { composition: Composition }) {
  const t = resolved(composition)
  if (!t) return null
  return <Thumbnail component={t.component} inputProps={t.props} frameToDisplay={t.still} durationInFrames={t.spec.durationInFrames} fps={t.spec.fps} compositionWidth={t.spec.width} compositionHeight={t.spec.height} style={{ width: "100%", height: "100%" }} />
}
