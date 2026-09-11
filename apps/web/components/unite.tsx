"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { ModeSwitcher } from "@/components/mode-switcher"
import ParticleMark from "@/components/flag-particles"
import { ParticleScroll } from "@/components/canvasui/ParticleScroll"
import { UniteParticleScroll } from "@/components/unite-particle-scroll"
import { SlideLink, useSlideArrival } from "@/components/unite-slide-link"

// /unite and /unite-2 (Brendan, 2026-09-10/11) — for now the same page on two
// routes, with slides between them. The hero is v2 from devtools
// (unite-hero-v2.html at the repo root): the flag alone in a padded field, one
// viewport tall. Below it (the blue band that marked the seam went on
// 2026-09-11) the second section — canvasui's Particle Scroll page
// (components/unite-particle-scroll.tsx). The question closes the page in the
// footer line: on /unite "America Today?" slides left over blue to /unite-2,
// and on /unite-2 it slides right over red back to /unite.
//
// One scroller for the whole page, as on canvasui: <ParticleScroll> is fixed
// over the viewport and everything scrolls inside it, so the document itself
// never does. The effect therefore covers the hero too — at rest, whatever is
// below 68% of the viewport (`point`) is sand until it scrolls up past the
// line. It needs the HTML-in-Canvas API: the origin-trial tokens in
// lib/origin-trials.ts switch it on for localhost:3000 and nysgpt.com;
// elsewhere Chrome needs the flag, and without it the page is plain HTML in
// the same single scroller.
//
// The `unite` slot hides the site header and the site footer, so the header's
// appearance button is pinned where it normally sits, top right. Here its
// second pair is Red state and Blue state: Dark Mode with the black replaced
// (app/unite/unite.css). They colour this page's wrapper only — the site's own
// theme is never touched, so leaving /unite leaves them behind — and the
// choice is remembered in this browser. v2's 200px of padding is the desktop
// value; it steps down with the screen or a phone would have no room left for
// the flag.

export function Unite({ code }: { code: string }) {
  const pathname = usePathname()
  const router = useRouter()
  useSlideArrival()

  const onFirst = pathname !== "/unite-2"
  const other = onFirst ? "/unite-2" : "/unite"
  // Warm the other route so the slide is not left waiting on it.
  useEffect(() => router.prefetch(other), [router, other])

  return (
    <div
      data-slot="unite"
      className="relative flex min-h-svh flex-col"
    >
      <div className="fixed top-0 right-0 z-50 flex h-(--header-height) items-center px-6">
        <ModeSwitcher />
      </div>
      <ParticleScroll className="inset-0 z-30" style={{ position: "fixed" }}>
        <div className="min-h-full bg-background text-foreground">
          <section className="flex h-svh flex-col items-center p-4 sm:p-12 lg:p-24 xl:p-50">
            <div className="relative min-h-56 w-full flex-1">
              <ParticleMark fit={1} className="absolute inset-0" />
            </div>
          </section>
          <UniteParticleScroll code={code} />
          <footer className="container-wrapper px-4 xl:px-6">
            <div className="flex h-(--footer-height) items-center justify-between">
              <div className="w-full px-1 text-center text-xs leading-loose sm:text-sm">
                What&apos;s wrong with{" "}
                <SlideLink
                  href={other}
                  direction={onFirst ? "forward" : "back"}
                  className="inline"
                  linkClassName="font-medium underline underline-offset-4"
                >
                  America Today?
                </SlideLink>
                .
              </div>
            </div>
          </footer>
        </div>
      </ParticleScroll>
    </div>
  )
}
