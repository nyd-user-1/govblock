"use client"

import * as React from "react"

import { resolve } from "@/lib/policy/snapshot"

// The `useSWR(key, fetcher, options)` shape livingston-v3's FEC explorer calls.
//
// FEC is the one surface still answered from the committed snapshot rather than
// from Aurora: the candidate summaries live in the FEC parquet mirror on S3, not
// in the policy database, and there is no /api/fec route here yet. The rows do
// carry the seat's state, so `resolve` scopes them by jurisdiction — the
// explorer is honest about which state it is showing, it is simply reading a
// committed extract of the 2026 cycle rather than the whole mirror.
export default function useSWR<T>(key: string | null, _fetcher?: unknown, _options?: unknown) {
  const [state, setState] = React.useState<{ key: string | null; data: T | undefined }>({ key: null, data: undefined })
  React.useEffect(() => {
    setState({ key, data: key ? (resolve(key) as T | undefined) : undefined })
  }, [key])
  return { data: state.data, error: undefined as Error | undefined, isLoading: !!key && state.key !== key }
}
