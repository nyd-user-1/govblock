"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAccount } from "@/lib/auth/use-account"
import { AccountMenu } from "@/components/account-menu"
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

export function AccountAffordance() {
  // The session, over the wire, cached in the tab: lib/auth/use-account.ts.
  const { account } = useAccount()
  const pathname = usePathname() ?? "/"

  if (!account) {
    // On /auth the page itself is the invitation (Brendan, 2026-09-13).
    if (pathname === "/auth") return null
    // The primary button where the New button stood (Brendan's markup,
    // 2026-09-07): "Sign In", to the account page.
    return (
      <Button render={<Link href="/auth" />} nativeButton={false} size="sm" className="h-[31px] rounded-lg">
        Sign In
      </Button>
    )
  }

  // Signed in: the avatar opens the account menu (components/account-menu.tsx).
  return <AccountMenu account={account} />
}
