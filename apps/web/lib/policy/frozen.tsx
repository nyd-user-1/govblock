"use client"

import * as React from "react"

// A demonstration that reads nothing (Brendan, 2026-09-20): under this
// provider `useSnapshot` answers each URL from the answers handed in here —
// a file written by scripts/root-sheets/freeze.mjs — and makes no request,
// whatever is pressed. The root's account-home sheet wears it. Without the
// provider the hook behaves as it always has.

type Frozen = Record<string, unknown>

const Context = React.createContext<Frozen | null>(null)

export function FrozenPolicyProvider({ answers, children }: { answers: Frozen; children: React.ReactNode }) {
  return <Context.Provider value={answers}>{children}</Context.Provider>
}

/** null outside a frozen page: fetch as usual. */
export function useFrozenPolicy() {
  return React.useContext(Context)
}

/** The answer on file for a URL; a tile's refresh button only adds a nonce, which the file does not carry. */
export function frozenAnswer(frozen: Frozen, key: string) {
  const url = new URL(key, "http://frozen")
  url.searchParams.delete("nonce")
  return frozen[url.pathname + url.search]
}
