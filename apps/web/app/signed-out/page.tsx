import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@govblock/ui/components/nova/button"

// /signed-out (Brendan, 2026-09-14): where signing out lands, modelled on
// Webflow's "Matrix" logged-out page — one line that says what happened, one
// that says it is reversible, one button back in. The header above it already
// carries Sign In and the way to Congress. Animation later, by his hand.

export const metadata: Metadata = { title: "Signed out", description: "This device's session is closed." }

export default function SignedOutPage() {
  return (
    <section className="flex min-h-[calc(100svh-var(--header-height))] items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-xl flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-6xl">You&rsquo;ve signed out.</h1>
        <p className="max-w-md text-lg text-muted-foreground text-balance">This device&rsquo;s session is closed. Sign back in anytime.</p>
        <Button render={<Link href="/sign-in" />} nativeButton={false} size="lg" className="mt-2 h-11 rounded-lg px-6 text-base">
          Sign back in
        </Button>
      </div>
    </section>
  )
}
