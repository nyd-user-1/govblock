"use client"

import * as React from "react"

// How a reader likes the law set (Brendan, 2026-09-19, after esv.org's Text
// Settings): the view, the type, the theme, and what the text shows. Kept in
// this browser; the right rail's Settings view writes it, and the reader and
// every open tab hear the change at once.

export type ReaderSettings = {
  view: "reading" | "code"
  /** 0–4, the text size step: 15, 16, 18, 20, 22 px. */
  size: number
  /** 0–2: line height 1.55, 1.8, 2.05. */
  spacing: number
  font: "serif" | "sans" | "mono"
  theme: "light" | "sepia" | "dark" | "auto"
  headings: boolean
  numbers: boolean
  crossrefs: boolean
  /** Notes as markers; off, they stand inline where the source printed them. */
  notes: boolean
  justify: boolean
}

export const DEFAULTS: ReaderSettings = {
  view: "reading",
  size: 1,
  spacing: 1,
  font: "serif",
  theme: "auto",
  headings: true,
  numbers: true,
  crossrefs: true,
  notes: true,
  justify: false,
}

export const SIZES = [15, 16, 18, 20, 22]
export const SPACINGS = [1.55, 1.8, 2.05]
export const FONTS: Record<ReaderSettings["font"], string> = {
  serif: `"Iowan Old Style", "Charter", "Source Serif 4", Georgia, serif`,
  sans: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
  mono: "var(--font-mono, ui-monospace, monospace)",
}

const KEY = "govblock-reader-settings"
const CHANGE = "govblock-reader-settings-change"
let cache: { raw: string | null; value: ReaderSettings } = { raw: null, value: DEFAULTS }

function read(): ReaderSettings {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    return cache.value
  }
  if (raw === cache.raw) return cache.value
  let value = DEFAULTS
  try {
    value = { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) }
  } catch {}
  cache = { raw, value }
  return value
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange()
  }
  window.addEventListener(CHANGE, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE, onChange)
    window.removeEventListener("storage", onStorage)
  }
}

export function useReaderSettings(): ReaderSettings {
  return React.useSyncExternalStore(subscribe, read, () => DEFAULTS)
}

export function setReaderSettings(patch: Partial<ReaderSettings>) {
  const next = { ...read(), ...patch }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  window.dispatchEvent(new Event(CHANGE))
}
