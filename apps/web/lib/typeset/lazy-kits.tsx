"use client"

import * as React from "react"
import type { AnyPluginConfig } from "platejs"

// Kits a bill's editor does without until asked (Brendan, 2026-09-13): the
// toolbar keeps every button, and a button whose kit is not in the editor
// loads it on demand. Hover fetches the code; the click adds the kit to the
// editor and then opens the feature. typeset-perf measured the kits left out
// of BillKit at 20 ms a keystroke, which is why they are not simply always on.

export type LazyKit = "ai" | "fontSize" | "toggle" | "emoji" | "media" | "math"

const LOADERS: Record<LazyKit, () => Promise<AnyPluginConfig[]>> = {
  ai: async () => {
    const [copilot, ai] = await Promise.all([import("@/components/plate/editor/plugins/copilot-kit"), import("@/components/plate/editor/plugins/ai-kit")])
    return [...copilot.CopilotKit, ...ai.AIKit] as AnyPluginConfig[]
  },
  fontSize: () => import("@/components/plate/editor/plugins/font-kit").then((m) => m.FontKit.filter((p) => p.key === "fontSize" || p.key === "fontFamily") as AnyPluginConfig[]),
  toggle: () => import("@/components/plate/editor/plugins/toggle-kit").then((m) => m.ToggleKit as AnyPluginConfig[]),
  emoji: () => import("@/components/plate/editor/plugins/emoji-kit").then((m) => m.EmojiKit as AnyPluginConfig[]),
  media: () => import("@/components/plate/editor/plugins/media-kit").then((m) => m.MediaKit as AnyPluginConfig[]),
  math: () => import("@/components/plate/editor/plugins/math-kit").then((m) => m.MathKit as AnyPluginConfig[]),
}

const modules = new Map<LazyKit, Promise<AnyPluginConfig[]>>()

/** The kit's code, fetched once. */
function load(name: LazyKit) {
  let promise = modules.get(name)
  if (!promise) {
    promise = LOADERS[name]()
    modules.set(name, promise)
  }
  return promise
}

export type LazyKits = {
  /** Fetch the code, nothing more: for a hover. */
  preload: (name: LazyKit) => void
  /** Add the kit to the editor; resolves once the editor has been rebuilt with it. */
  enable: (name: LazyKit) => Promise<void>
}

const LazyKitsContext = React.createContext<LazyKits | null>(null)

export const LazyKitsProvider = LazyKitsContext.Provider

/** The toolbar's side: null where the editor has no on-demand kits (the template, the disabled toolbar). */
export function useLazyKits() {
  return React.useContext(LazyKitsContext)
}

/** The editor's side: the kits enabled so far, as plugins to add to the base kit. */
export function useLazyKitState() {
  const [loaded, setLoaded] = React.useState<Partial<Record<LazyKit, AnyPluginConfig[]>>>({})
  const preload = React.useCallback((name: LazyKit) => {
    void load(name)
  }, [])
  const enable = React.useCallback(async (name: LazyKit) => {
    const kit = await load(name)
    setLoaded((prev) => (prev[name] ? prev : { ...prev, [name]: kit }))
  }, [])
  const plugins = React.useMemo(() => Object.values(loaded).flat() as AnyPluginConfig[], [loaded])
  return { plugins, preload, enable }
}
