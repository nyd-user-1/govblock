"use client"

import * as React from "react"

// How a reader likes a bill's text: Read or Code, wrapped or not, unified or
// split, folding, centred. Kept in localStorage like `useLocal`, but shared —
// every hook on the same key sees a change at once, so the file-actions menu
// in the block's header and the pane below it are one set of switches.

const EVENT = "govblock:doc-prefs"
const PREFIX = "govblock:documents:"

function read<T>(key: string, initial: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw === null ? initial : (JSON.parse(raw) as T)
  } catch {
    return initial
  }
}

export function useDocPref<T>(key: string, initial: T) {
  const subscribe = React.useCallback((notify: () => void) => {
    window.addEventListener(EVENT, notify)
    window.addEventListener("storage", notify)
    return () => {
      window.removeEventListener(EVENT, notify)
      window.removeEventListener("storage", notify)
    }
  }, [])
  // The server and the first client render agree on the default; the stored
  // value arrives on the first subscription tick, as with `useLocal`.
  const snapshot = React.useSyncExternalStore(subscribe, () => JSON.stringify(read(key, initial)), () => JSON.stringify(initial))
  const value = React.useMemo(() => JSON.parse(snapshot) as T, [snapshot])
  const set = React.useCallback(
    (next: T | ((previous: T) => T)) => {
      const previous = read(key, initial)
      const resolved = typeof next === "function" ? (next as (p: T) => T)(previous) : next
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(resolved))
      } catch {
        // Private mode, or a full store: the value lives for this render only.
      }
      window.dispatchEvent(new Event(EVENT))
    },
    [key, initial]
  )
  return [value, set] as const
}

/** What the file-actions menu asks the pane to do: things only the pane can. */
export type FileAction = "download" | "jump"
export const FILE_ACTION = "govblock:file-action"
export function fileAction(action: FileAction) {
  window.dispatchEvent(new CustomEvent<FileAction>(FILE_ACTION, { detail: action }))
}
