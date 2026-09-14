"use client"

import * as React from "react"

import type { Entity } from "@/lib/entitlements"

// A record page says what it is about (Brendan, 2026-09-13): a bill by id
// names no jurisdiction in its path, so the page that read the bill sets
// the mark and the gate over the whole app reads it. One mark at a time —
// one page at a time — kept outside React so the gate, which sits above
// every page in the layout, can hear a page beneath it.

export type Mark = { state: string; session?: number | null; current?: number | null; entity: Entity }

let mark: Mark | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function set(next: Mark | null) {
  mark = next
  listeners.forEach((listener) => listener())
}

export function useScopeMark(): Mark | null {
  return React.useSyncExternalStore(subscribe, () => mark, () => null)
}

/** Mounted by a page that knows its own scope; unmounts with it. */
export function ScopeMark({ state, session = null, current = null, entity }: Mark) {
  React.useEffect(() => {
    set({ state, session, current, entity })
    return () => set(null)
  }, [state, session, current, entity])
  return null
}
