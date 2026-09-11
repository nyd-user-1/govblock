"use client"

import { useLayoutEffect, type MouseEvent, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import { ThemeToggleSlideLeft } from "@govblock/ui/components/animbits/theme-toggle-slide-left"
import { ThemeToggleSlideRight } from "@govblock/ui/components/animbits/theme-toggle-slide-right"

// Route-to-route slides between /unite and /unite-2 (Brendan, 2026-09-11):
// forward is animbits' slide-left over the flag's blue, back is slide-right
// over its red (app/unite/unite.css).
//
// A view transition takes its "after" snapshot when its callback settles, so
// the callback returns a promise that the destination page resolves when it
// mounts (`useSlideArrival`). If the route is slow to arrive — a dev compile —
// the promise gives up after three seconds rather than holding the page
// frozen, and the navigation lands without the slide.

let arrive: (() => void) | null = null

/** Called by the page a slide lands on; releases the waiting transition. */
export function useSlideArrival() {
  const pathname = usePathname()
  useLayoutEffect(() => {
    arrive?.()
    arrive = null
  }, [pathname])
}

export function SlideLink({
  href,
  direction,
  className,
  linkClassName,
  children,
}: {
  href: string
  direction: "forward" | "back"
  className?: string
  linkClassName?: string
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const navigate = () => {
    if (href === pathname) return
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 3000)
      arrive = () => {
        clearTimeout(timer)
        resolve()
      }
      router.push(href)
    })
  }

  // The wrapper runs the slide; the anchor keeps a real href for new tabs and
  // copy-link, and only a plain click is handed to the wrapper.
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      e.stopPropagation()
      return
    }
    e.preventDefault()
  }

  const link = (
    <a href={href} onClick={onClick} className={linkClassName}>
      {children}
    </a>
  )

  return direction === "forward" ? (
    <ThemeToggleSlideLeft onToggle={navigate} className={className}>
      {link}
    </ThemeToggleSlideLeft>
  ) : (
    <ThemeToggleSlideRight onToggle={navigate} className={className}>
      {link}
    </ThemeToggleSlideRight>
  )
}
