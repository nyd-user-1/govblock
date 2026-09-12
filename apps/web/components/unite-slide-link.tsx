"use client"

import type { MouseEvent, ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import { runCurtain, useCurtainArrival, type CurtainDirection } from "@/components/page-curtain"

// Route-to-route moves between /unite and /unite-2 (Brendan, 2026-09-11).
// Until 2026-09-12 they were animbits' slide-left over the flag's blue and
// slide-right over its red; now they are the page curtain (page-curtain.tsx):
// the same two colours, a tilted edge, and the name of the page being opened
// carried across on the sheet.

/** What the curtain says it is bringing. */
const TITLES: Record<string, string> = {
  "/unite": "Unite",
  "/unite-2": "America Today",
}

/** Called by the page a curtain lands on; releases the sheet to draw back. */
export const useSlideArrival = useCurtainArrival

export function SlideLink({
  href,
  direction,
  title,
  className,
  linkClassName,
  children,
}: {
  href: string
  direction: CurtainDirection
  /** The name painted on the curtain; the destination's own by default. */
  title?: string
  className?: string
  linkClassName?: string
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  // The anchor keeps a real href for new tabs and copy-link; only a plain
  // click is taken over by the curtain.
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    if (href === pathname) return
    void runCurtain({ direction, title: title ?? TITLES[href] ?? "", navigate: () => router.push(href) })
  }

  return (
    <span className={className}>
      <a href={href} onClick={onClick} className={linkClassName}>
        {children}
      </a>
    </span>
  )
}
