"use client"

import * as React from "react"
import Link from "next/link"

import { AnimateIcon } from "@govblock/ui/components/animate-ui/icons/icon"
import { LogoMark } from "@/components/logo-mark"
import { useAccount } from "@/lib/auth/use-account"
import { cn } from "@govblock/ui/lib/utils"

// The mark, at the left of the header (Brendan, 2026-09-12): 30px. A link
// (Brendan, 2026-09-14): the root for a reader who is not signed in, /home
// for one who is; it no longer opens the left rail, whose own tab does that.
// A grey ring on hover and focus. The blocks move on hover as they do in the
// menus.
export function LogoButton({ className }: { className?: string }) {
  const { signedIn } = useAccount()
  return (
    <AnimateIcon asChild animateOnHover>
      <Link
        href={signedIn ? "/home" : "/"}
        aria-label={signedIn ? "Home" : "GovBlock"}
        className={cn(
          "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none ring-muted-foreground/40 transition-shadow hover:ring-2 focus-visible:ring-[3px]",
          className
        )}
      >
        <LogoMark className="size-[30px] shrink-0" aria-hidden />
      </Link>
    </AnimateIcon>
  )
}
