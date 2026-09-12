"use client"

import * as React from "react"

import { useAccount } from "@/lib/auth/use-account"
import { useJurisdiction } from "@/lib/policy/jurisdiction"

// The reader's home state, for the two places that show Congress beside it:
// the header's flag stack and the rail's Scope (Brendan, 2026-09-12: clicking
// into Congress turned "New York" into a second "Congress" and dropped the
// state's flag from the header). The profile's home wins; a signed-in reader
// with no profile home keeps the last state they read, remembered in this
// browser, so moving to Congress never erases it.

const KEY = "govblock:home-state"
const CONGRESS = "US"

export function useHomeState(): string | null {
  const { state } = useJurisdiction()
  const { account, signedIn } = useAccount()
  const [remembered, setRemembered] = React.useState<string | null>(null)
  React.useEffect(() => {
    try {
      setRemembered(localStorage.getItem(KEY))
    } catch {}
  }, [])
  React.useEffect(() => {
    if (!signedIn || !state || state === CONGRESS) return
    setRemembered(state)
    try {
      localStorage.setItem(KEY, state)
    } catch {}
  }, [signedIn, state])
  if (account?.home && account.home !== CONGRESS) return account.home
  if (!signedIn) return null
  return remembered ?? (state !== CONGRESS ? state : null)
}
