"use client"

import * as React from "react"
import { Player } from "@remotion/player"

import { resolved } from "./composition-player"
import type { Clip } from "./store"

// A posted clip on someone else's page (Studio's Get Code, 2026-09-14): the
// clip alone, filling the frame, with the player's own controls.

export function ClipEmbed({ clip }: { clip: Clip }) {
  // The player draws in the browser only.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  if (!mounted) return null
  const c = clip.composition
  if (c) {
    const t = resolved(c)
    if (!t) return null
    return <Player component={t.component} inputProps={t.props} durationInFrames={t.spec.durationInFrames} fps={t.spec.fps} compositionWidth={t.spec.width} compositionHeight={t.spec.height} style={{ width: "100%", height: "100%" }} controls loop autoPlay clickToPlay />
  }
  if (clip.youtube) return <iframe src={`https://www.youtube-nocookie.com/embed/${clip.youtube}`} title={clip.title} className="size-full border-0" allow="autoplay; fullscreen" allowFullScreen />
  return <video src={clip.src} poster={clip.poster} controls playsInline loop className="size-full bg-black object-contain" />
}
