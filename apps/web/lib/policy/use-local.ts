"use client"

import * as React from "react"

// Ported verbatim from livingston-v3 lib/policy/use-local.ts. Per-browser state for the widgets that need a user (notes, tracked bills,
// tasks, preferences) until there is an account to attach them to. Reads
// after mount so the server and first client render agree.
export function useLocal<T>(key: string, initial: T) {
  const [value, setValue] = React.useState<T>(initial)

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        setValue(JSON.parse(raw) as T)
      } else {
        setValue(initial)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const set = React.useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(previous) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch {}
        return resolved
      })
    },
    [key]
  )

  return [value, set] as const
}
