"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Button } from "@govblock/ui/components/nova/button"

// The header's account affordance — and the reason it is a client component
// rather than the obvious `await auth()`.
//
// `auth()` reads cookies, and a cookie read anywhere in the ROOT LAYOUT opts
// every route that layout wraps into dynamic rendering. Measured on this app
// rather than assumed: the build prerenders **117 pages**, and putting the
// session in the header would have turned all 117 into per-request Lambda
// renders on Amplify to draw one avatar. PPR is the feature that would let a
// static shell hold a dynamic hole, and this app does not have it switched on
// (`next.config.ts` sets no `cacheComponents`); turning it on is a whole-app
// change and not this lane's to make.
//
// So the session comes over the wire instead, from Auth.js's own
// `/api/auth/session`. What that costs, stated rather than buried: one small
// GET per hard page load, hitting the function rather than the CDN. It is one
// request against a page that already loads a font and a script, and
// `sessionStorage` collapses it to a paint-time answer for every load after the
// first in a tab. If traffic ever makes it matter, the cheap fix is a
// non-httpOnly hint cookie set at sign-in so signed-out readers never fetch at
// all — worth knowing about, not worth building before anyone has signed in.
//
// Signed out is the FIRST paint, deliberately: it is the common case, it is the
// truth until proven otherwise, and it means the usual reader sees no skeleton
// and nothing shifts under them.

type Account = { name?: string | null; email?: string | null; image?: string | null } | null

const CACHE_KEY = "govblock:account"

function cached(): Account {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

export function AccountAffordance() {
  const [account, setAccount] = useState<Account>(null)

  // Paint from the tab's cache first so a signed-in reader does not watch their
  // own avatar appear on every load, then confirm against the server — the
  // cache can be stale (an expired session, a sign-out in another tab) and the
  // server's answer always wins.
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
          if (user) sessionStorage.setItem(CACHE_KEY, JSON.stringify(user))
          else sessionStorage.removeItem(CACHE_KEY)
        } catch {
          // Storage refused. The affordance still works; it just re-fetches.
        }
      })
      .catch(() => {
        // No session endpoint — sign-in is not configured on this deployment.
        // /auth says so in words; the header stays a door to it.
      })
    return () => {
      live = false
    }
  }, [])

  const label = account?.name ?? account?.email ?? null

  if (!account) {
    return (
      <Button
        render={<Link href="/auth" />}
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="h-[31px] rounded-lg"
      >
        Sign in
      </Button>
    )
  }

  return (
    <Link
      // Signed in, /auth redirects to the reader's home — so the affordance
      // asks for the one thing that page still has to offer. Without the
      // parameter this link would bounce and a signed-in reader would have no
      // way to sign out at all.
      href="/auth?signout=1"
      title={label ? `Signed in as ${label}` : "Account"}
      aria-label={label ? `Account — signed in as ${label}` : "Account"}
      className="flex size-[31px] shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold transition-opacity hover:opacity-80"
    >
      {account.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.image} alt="" width={31} height={31} className="size-full object-cover" />
      ) : (
        (label ?? "?").slice(0, 1).toUpperCase()
      )}
    </Link>
  )
}
