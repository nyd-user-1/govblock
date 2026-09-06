"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"

// When the Sessions menu moves a page to another session, the sentences whose
// numbers are about to change say so: each figure pulses as a skeleton until
// the new page lands (Brendan, 2026-09-05: "we need something that lets the
// user know"). The menu starts a transition and marks it pending here; every
// Figure on the page reads the flag. The new page arrives with its own
// provider, so the flag clears itself.

const Ctx = React.createContext<{ pending: boolean; start: (navigate: () => void) => void }>({ pending: false, start: (navigate) => navigate() })

export function PendingSessionProvider({ children }: { children: React.ReactNode }) {
  const [pending, startTransition] = React.useTransition()
  const start = React.useCallback((navigate: () => void) => startTransition(() => navigate()), [])
  const value = React.useMemo(() => ({ pending, start }), [pending, start])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const usePendingSession = () => React.useContext(Ctx)

/** A number in a sentence that follows the session: in code, and a skeleton while the next session loads. */
export function Figure({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = usePendingSession()
  return (
    <code className={cn("transition-opacity", pending && "animate-pulse rounded bg-muted text-transparent select-none", className)} aria-busy={pending || undefined}>
      {children}
    </code>
  )
}
