"use client"

import { useEffect, useState } from "react"

// Who is signed in, on the client, from Auth.js's own `/api/auth/session`.
// The header's account affordance explains why the session comes over the
// wire rather than from `auth()` in the layout (a cookie read in the root
// layout would make all 117 prerendered pages dynamic); this is that fetch,
// once, for every surface that needs the answer — the affordance, and the
// datasets grid that opens a reader's home state to them.
//
// Signed out is the first paint, deliberately: it is the common case and the
// truth until proven otherwise. The tab's cache paints a signed-in reader
// without a flash; the server's answer always wins.

export type Account = { name?: string | null; email?: string | null; image?: string | null } | null

export const ACCOUNT_CACHE_KEY = "govblock:account"

function cached(): Account {
  try {
    const raw = sessionStorage.getItem(ACCOUNT_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

export function useAccount(): { account: Account; signedIn: boolean } {
  const [account, setAccount] = useState<Account>(null)

  useEffect(() => {
    setAccount(cached())
    let live = true
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((session: { user?: NonNullable<Account> } | null) => {
        if (!live) return
        const user = session?.user ?? null
        setAccount(user)
        try {
          if (user) sessionStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(user))
          else sessionStorage.removeItem(ACCOUNT_CACHE_KEY)
        } catch {
          // Storage refused. The answer still arrived; it just re-fetches next load.
        }
      })
      .catch(() => {
        // No session endpoint — sign-in is not configured on this deployment.
      })
    return () => {
      live = false
    }
  }, [])

  return { account, signedIn: !!account }
}
