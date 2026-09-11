"use client"

import * as React from "react"
import Link from "next/link"
import { XIcon } from "lucide-react"

import { DEFAULT_AVATAR, useAccount } from "@/lib/auth/use-account"
import { Button } from "@govblock/ui/components/nova/button"
import { Popover, PopoverContent, PopoverTrigger } from "@govblock/ui/components/nova/popover"

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

// The portrait hint (Brendan, 2026-09-11): a reader wearing the default
// portrait is told so once, in a callout under the avatar, and never again
// after they close it or click through. This browser remembers.
const HINT_KEY = "govblock:portrait-hint:dismissed"

export function AccountAffordance() {
  // The session, over the wire, cached in the tab: lib/auth/use-account.ts.
  const { account } = useAccount()

  const label = account?.name ?? account?.email ?? null

  const wearsDefault = account?.image === DEFAULT_AVATAR
  const [hint, setHint] = React.useState(false)
  React.useEffect(() => {
    if (!wearsDefault) return setHint(false)
    try {
      setHint(localStorage.getItem(HINT_KEY) !== "1")
    } catch {
      setHint(true)
    }
  }, [wearsDefault])
  const dismiss = () => {
    setHint(false)
    try {
      localStorage.setItem(HINT_KEY, "1")
    } catch {
      // Storage refused; the hint returns next load, which is the honest fallback.
    }
  }

  if (!account) {
    // The primary button where the New button stood (Brendan's markup,
    // 2026-09-07): "Sign In", to the account page.
    return (
      <Button render={<Link href="/auth" />} nativeButton={false} size="sm" className="h-[31px] rounded-lg">
        Sign In
      </Button>
    )
  }

  const avatar = (
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

  return (
    // Any close — the X, a click outside, Escape, or the avatar itself — is the dismissal.
    <Popover open={hint} onOpenChange={(open) => !open && dismiss()}>
      <PopoverTrigger render={avatar} nativeButton={false} />
      <PopoverContent side="bottom" align="end" sideOffset={8} className="w-max max-w-72 flex-row items-start gap-2 py-2 pr-1.5 pl-3">
        <p className="py-0.5">You are not George Washington. Add your portrait here.</p>
        <Button variant="ghost" size="icon-xs" aria-label="Dismiss" className="shrink-0" onClick={dismiss}>
          <XIcon />
        </Button>
      </PopoverContent>
    </Popover>
  )
}
