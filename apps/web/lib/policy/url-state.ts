"use client"

import * as React from "react"

// The URL, readable from anywhere without opting a page out of prerendering.
//
// `useSearchParams()` (and therefore every nuqs hook, which calls it) makes
// Next bail out of static generation unless a Suspense boundary sits above
// the component — a hard build error, not a warning. The legislative scope is
// read by cards that live all over the site (the home grid, /blocks, the
// calendar shell, the block previews under /view), so requiring a boundary
// above each one is a trap that only shows up in a Vercel build.
//
// This reads `location.search` through useSyncExternalStore instead: empty on
// the server, live on the client. Writes go through `history.replaceState`,
// which nuqs patches — so /create's design-system params stay in sync with
// what the header writes, and no page has to know.

const SEARCH_EVENT = "govblock:urlchange"

let patched = false

// Wrap the history methods so a shallow URL write notifies our subscribers.
// nuqs patches the same two methods for the same reason; both wrappers call
// through, so whichever installs first, both get their notification.
function ensurePatched() {
  if (patched || typeof window === "undefined") return
  patched = true
  const notify = () => window.dispatchEvent(new Event(SEARCH_EVENT))
  const push = window.history.pushState.bind(window.history)
  const replace = window.history.replaceState.bind(window.history)
  window.history.pushState = function (...args) {
    push(...(args as Parameters<typeof push>))
    notify()
  }
  window.history.replaceState = function (...args) {
    replace(...(args as Parameters<typeof replace>))
    notify()
  }
}

function subscribe(onChange: () => void) {
  ensurePatched()
  window.addEventListener("popstate", onChange)
  window.addEventListener(SEARCH_EVENT, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener(SEARCH_EVENT, onChange)
  }
}

const getSnapshot = () => window.location.search
const getServerSnapshot = () => ""

/** The raw query string, or "" while prerendering. */
export function useUrlSearch() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** The named params, "" for any that is absent. */
export function useUrlParams<K extends string>(
  keys: readonly K[]
): Record<K, string> {
  const search = useUrlSearch()
  const signature = keys.join(",")
  return React.useMemo(() => {
    const params = new URLSearchParams(search)
    const out = {} as Record<K, string>
    for (const key of keys) out[key] = params.get(key) ?? ""
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, signature])
}

/**
 * Write params into the URL without a server round trip. `null` or `""`
 * removes the key. Next supports `history.replaceState` for shallow updates,
 * and nuqs's history patch mirrors it into every nuqs hook on the page.
 */
export function writeUrlParams(
  updates: Record<string, string | null | undefined>,
  { history: mode = "replace" }: { history?: "replace" | "push" } = {}
) {
  if (typeof window === "undefined") return
  ensurePatched()
  const params = new URLSearchParams(window.location.search)
  let changed = false
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue
    const next = value ?? ""
    const current = params.get(key) ?? ""
    if (current === next) continue
    changed = true
    if (next === "") params.delete(key)
    else params.set(key, next)
  }
  if (!changed) return
  const query = params.toString()
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
  const state = window.history.state
  if (mode === "push") window.history.pushState(state, "", url)
  else window.history.replaceState(state, "", url)
}
