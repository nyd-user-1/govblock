"use client"

import { useEffect, useSyncExternalStore } from "react"

// Who is signed in, on the client, from Auth.js's own `/api/auth/session`.
// The header's account affordance explains why the session comes over the
// wire rather than from `auth()` in the layout (a cookie read in the root
// layout would make all 117 prerendered pages dynamic); this is that fetch,
// once, for every surface that needs the answer — the affordance, and the
// datasets grid that opens a reader's home state to them.
//
// Signed out is the first paint, deliberately: it is the common case and the
// truth until proven otherwise. The tab's cache paints a signed-in reader
// without a flash; the server's answer always wins. `ready` says the answer
// is in — from the cache, or from the server — so a gate can wait for it
// rather than greet a signed-in reader as a stranger (2026-09-13).
//
// One answer for the whole page, in a store (2026-09-22). Each hook used to
// hold its own copy and read it once on mount, and the header never mounts
// twice: signing out took the reader to a new page without remounting the
// header, so the avatar and the home state's flag stayed up as if nothing had
// happened (Brendan: "the user logged out but it's still showing the elements
// in the navbar as if they were logged in"). `forgetAccount` now empties the
// store and every surface reading it turns over in the same beat.

export type Account = { name?: string | null; email?: string | null; image?: string | null; /** The home state from the reader's profile (onboarding, 2026-09-11); null until they have one. */ home?: string | null; /** Set by hand on the profile row (2026-09-14): the gates open, and the cards keep a close cross. */ admin?: boolean } | null

export const ACCOUNT_CACHE_KEY = "govblock:account"

/** This device has signed in at least once (2026-09-22). Outlives the session and the tab: it is what turns Sign Up into Sign In. */
export const ACCOUNT_KNOWN_KEY = "govblock:account-known"

// The portrait every reader wears until they upload their own (Brendan,
// 2026-09-11): Gilbert Stuart's George Washington, National Gallery of Art
// 1979.5.1, cropped square at 512 px in public/avatars.
export const DEFAULT_AVATAR = "/avatars/default.jpg"

/** The account as the surfaces read it: a reader with no photo has the default one. */
const withAvatar = (user: NonNullable<Account>): NonNullable<Account> => ({ ...user, image: user.image || DEFAULT_AVATAR })

function cached(): Account {
  try {
    const raw = sessionStorage.getItem(ACCOUNT_CACHE_KEY)
    const user = raw ? (JSON.parse(raw) as Account) : null
    return user ? withAvatar(user) : null
  } catch {
    return null
  }
}

/** True where this browser has signed in before; false on the server and on a device that never has. */
export function knownDevice(): boolean {
  try {
    return localStorage.getItem(ACCOUNT_KNOWN_KEY) === "1"
  } catch {
    return false
  }
}

type Snapshot = { account: Account; ready: boolean }

const SIGNED_OUT: Snapshot = { account: null, ready: false }
let snapshot: Snapshot = SIGNED_OUT
let asked = false
const listeners = new Set<() => void>()

const publish = (next: Snapshot) => {
  snapshot = next
  listeners.forEach((l) => l())
}

const remember = (user: Account) => {
  try {
    if (user) {
      sessionStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(user))
      localStorage.setItem(ACCOUNT_KNOWN_KEY, "1")
    } else sessionStorage.removeItem(ACCOUNT_CACHE_KEY)
  } catch {
    // Storage refused. The answer still arrived; it just re-fetches next load.
  }
}

/** Writes the tab's cache and the store, for the moment a page learns something the server will only confirm on the next read. */
export function cacheAccount(patch: Partial<NonNullable<Account>>) {
  const current = snapshot.account ?? cached()
  if (!current) return
  const next = { ...current, ...patch }
  remember(next)
  publish({ account: next, ready: true })
}

/**
 * The session is over: the store, the tab's cache and the jurisdiction this
 * browser remembers (components/sign-out-button.tsx clears those keys). Called
 * on the way out, before the server action redirects, so nothing on screen is
 * still wearing the account when the next page arrives. The device's memory
 * that it *has* an account is deliberately kept.
 */
export function forgetAccount() {
  remember(null)
  asked = false
  publish({ account: null, ready: true })
}

type Session = { user?: NonNullable<Account> } | null

function load() {
  if (asked) return
  asked = true
  const known = cached()
  if (known) publish({ account: known, ready: true })
  fetch("/api/auth/session", { credentials: "same-origin" })
    .then((response) => (response.ok ? (response.json() as Promise<Session>) : null))
    .then((session) => {
      const user = session?.user ? withAvatar(session.user) : null
      remember(user)
      publish({ account: user, ready: true })
    })
    .catch(() => {
      // No session endpoint — sign-in is not configured on this deployment.
      publish({ ...snapshot, ready: true })
    })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAccount(enabled = true): { account: Account; signedIn: boolean; ready: boolean } {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => SIGNED_OUT)
  useEffect(() => {
    if (enabled) load()
  }, [enabled])
  return { account: state.account, signedIn: !!state.account, ready: state.ready }
}
