"use client"

import * as React from "react"
import Link from "next/link"

import { useAccount } from "@/lib/auth/use-account"
import { stateName } from "@/lib/filters"
import { PathScopeContext, useJurisdiction } from "@/lib/policy/jurisdiction"
import { Button } from "@govblock/ui/components/nova/button"

// The jurisdiction a bills page names in its path (Brendan, 2026-09-11:
// /bills/ny), set over the list so every scoped hook under it reads New York
// whatever the header's flag says. The session is the jurisdiction's latest,
// which the route resolves when none is named.
export function BillsScope({ state, children }: { state: string; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ state, session: null, year: null, chamber: null, sessions: [] }), [state])
  return <PathScopeContext.Provider value={value}>{children}</PathScopeContext.Provider>
}

// Who may open a jurisdiction's bills, as the datasets grid decides it:
// Congress is open to everyone, a signed-in reader's home state is theirs.
// Everyone else sees the page under a gate: the list is there to be seen,
// blurred and inert, and a card over it offers the two ways on. No dialog —
// a dialog closes on a click past it, and this must not (Brendan,
// 2026-09-11: "that's not a very good gate"). The gate wraps the list and
// reads the home state outside BillsScope on purpose: under the scope the
// hook would answer the page's own state.
export function BillsGate({ state, children }: { state: string; children: React.ReactNode }) {
  const { account, signedIn } = useAccount()
  const { state: flag, resolved } = useJurisdiction()
  // The profile's home state (onboarding, 2026-09-11), or the header's flag for a reader who has none.
  const home = account?.home ?? flag
  // Nothing until the scope and the session are known: the prerendered page
  // is everyone's, and a flash of the gate at a signed-in New Yorker is
  // worse than a moment without it.
  const [known, setKnown] = React.useState(false)
  React.useEffect(() => {
    if (resolved) setKnown(true)
  }, [resolved, account])
  const open = !known || state === "US" || (signedIn && state === home)
  if (open) return <>{children}</>
  const name = stateName(state)
  return (
    <div className="relative">
      <div inert aria-hidden className="pointer-events-none min-h-[60vh] select-none opacity-60 blur-[3px]">
        {children}
      </div>
      <div role="dialog" aria-modal="true" aria-labelledby="bills-gate-title" data-not-typeset="true" className="absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-16">
        <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl border bg-popover p-6 text-popover-foreground shadow-lg">
          <h2 id="bills-gate-title" className="mt-0 text-xl font-semibold">
            {signedIn ? `${name} is not your home state.` : `Sign in to open ${name}.`}
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            {signedIn ? `Your account opens Congress and ${stateName(home)}. Every other state waits on a plan.` : "Congress is open to everyone. Your home state opens when you sign in."}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" render={<Link href="/bills/us" />} nativeButton={false}>
              Congress instead
            </Button>
            {signedIn ? (
              <Button render={<Link href={`/bills/${home.toLowerCase()}`} />} nativeButton={false}>
                Open {stateName(home)}
              </Button>
            ) : (
              <Button render={<Link href="/auth" />} nativeButton={false}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
