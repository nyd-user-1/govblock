"use client"

import * as React from "react"

import { ACCOUNT_CACHE_KEY } from "@/lib/auth/use-account"
import { JURISDICTION_KEY } from "@/lib/policy/scope-key"
import { Button } from "@govblock/ui/components/nova/button"

// Sign out (Brendan, 2026-09-13): the button in the /auth card. The server
// action ends the session; this clears what the browser remembered for the
// reader on the way out — the jurisdiction, the home state, the cached
// account — so the next visitor here starts where a stranger does, on
// Congress, and not in whatever state the last reader left the flag.

const HOME_STATE_KEY = "govblock:home-state"

/** What the browser forgets at sign-out. The account menu's Logout runs it too (2026-09-14). */
export function forgetAccount() {
  try {
    window.localStorage.removeItem(JURISDICTION_KEY)
    window.localStorage.removeItem(HOME_STATE_KEY)
    window.sessionStorage.removeItem(ACCOUNT_CACHE_KEY)
  } catch {
    // Storage refused; the session still ends.
  }
}

export function SignOutButton() {
  return (
    <Button type="submit" variant="outline" size="sm" onClick={forgetAccount}>
      Sign out
    </Button>
  )
}
