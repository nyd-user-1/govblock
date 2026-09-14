"use client"

import * as React from "react"

// The cards a reader adds to /workspace (Brendan, 2026-09-13): a bill, a
// session or a dataset, each from the + on its card or the empty slots on
// the workspace itself. They sit ahead of the surfaces, in this browser,
// until there are accounts to keep them in. One store for every reader of
// it on the page, so the + on a card and the slot that just took it agree.

export type WorkspacePin =
  | { kind: "dataset"; key: string }
  | { kind: "session"; state: string; chamber: string; session: number; title: string; bills?: number | null }
  | { kind: "bill"; state: string; chamber: string | null; session: number | null; billId: number; number: string; title: string }

export const PINS_KEY = "govblock:workspace:app:pins"

/** The grid key a pin draws under — the same pin, added twice, is one card. */
export function pinKey(pin: WorkspacePin): string {
  switch (pin.kind) {
    case "dataset":
      return `pin-dataset-${pin.key}`
    case "session":
      return `pin-session-${pin.state.toLowerCase()}-${pin.chamber.toLowerCase()}-${pin.session}`
    case "bill":
      return `pin-bill-${pin.billId}`
  }
}

const EMPTY: WorkspacePin[] = []
let cache: WorkspacePin[] | null = null
const listeners = new Set<() => void>()

function read(): WorkspacePin[] {
  if (cache) return cache
  try {
    const raw = window.localStorage.getItem(PINS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    cache = Array.isArray(parsed) ? (parsed as WorkspacePin[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: WorkspacePin[]) {
  cache = next
  try {
    window.localStorage.setItem(PINS_KEY, JSON.stringify(next))
  } catch {
    // Private mode: the pins last for this page.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab's change: forget the cache and re-read.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PINS_KEY) return
    cache = null
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function useWorkspacePins() {
  const pins = React.useSyncExternalStore(subscribe, read, () => EMPTY)
  const add = React.useCallback((pin: WorkspacePin) => {
    const current = read()
    if (!current.some((p) => pinKey(p) === pinKey(pin))) write([...current, pin])
  }, [])
  const remove = React.useCallback((key: string) => write(read().filter((p) => pinKey(p) !== key)), [])
  const has = React.useCallback((pin: WorkspacePin) => pins.some((p) => pinKey(p) === pinKey(pin)), [pins])
  return { pins, add, remove, has }
}
