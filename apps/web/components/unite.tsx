"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"

import { cn } from "@govblock/ui/lib/utils"
import { ModeSwitcher, type AppearanceItem } from "@/components/mode-switcher"
import ParticleMark from "@/components/flag-particles"
import { ParticleScroll } from "@/components/canvasui/ParticleScroll"
import { UniteParticleScroll } from "@/components/unite-particle-scroll"
import { SlideLink, useSlideArrival } from "@/components/unite-slide-link"

// /unite and /unite-2 (Brendan, 2026-09-10/11) — for now the same page on two
// routes, with slides between them. The hero is v2 from devtools
// (unite-hero-v2.html at the repo root): the flag alone in a padded field, one
// viewport tall. A 40px band of the flag's blue marks the seam, and below it
// the second section — canvasui's Particle Scroll page
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

type Palette = "red" | "blue"

const PALETTE_KEY = "unite-palette"

function usePalette() {
  const [palette, setPalette] = useState<Palette | null>(null)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PALETTE_KEY)
      if (saved === "red" || saved === "blue") setPalette(saved)
    } catch {}
  }, [])
  const choose = (next: Palette | null) => {
    setPalette(next)
    try {
      if (next) localStorage.setItem(PALETTE_KEY, next)
      else localStorage.removeItem(PALETTE_KEY)
    } catch {}
  }
  return [palette, choose] as const
}

export function Unite({ code }: { code: string }) {
  const pathname = usePathname()
  const router = useRouter()
  useSlideArrival()

  const onFirst = pathname !== "/unite-2"
  const other = onFirst ? "/unite-2" : "/unite"
  // Warm the other route so the slide is not left waiting on it.
  useEffect(() => router.prefetch(other), [router, other])

  const { theme, setTheme } = useTheme()
  const [palette, setPalette] = usePalette()
  const site = (value: "light" | "dark" | "system", label: string): AppearanceItem => ({
    key: value,
    label,
    checked: !palette && (theme ?? "system") === value,
    onSelect: () => {
      setPalette(null)
      setTheme(value)
    },
  })
  const state = (value: Palette, label: string): AppearanceItem => ({
    key: value,
    label,
    checked: palette === value,
    onSelect: () => setPalette(value),
  })
  const groups = [
    [site("light", "Light Mode"), site("dark", "Dark Mode")],
    [state("red", "Red State"), state("blue", "Blue State")],
    [site("system", "System")],
  ]

  return (
    <div
      data-slot="unite"
      className={cn(
        "relative flex min-h-svh flex-col",
        palette && `dark unite-${palette} bg-background text-foreground`
      )}
    >
      <div className="fixed top-0 right-0 z-50 flex h-(--header-height) items-center px-6">
        <ModeSwitcher groups={groups} />
      </div>
      <ParticleScroll className="inset-0 z-30" style={{ position: "fixed" }}>
        <div className="min-h-full bg-background text-foreground">
          <section className="flex h-svh flex-col items-center p-4 sm:p-12 lg:p-24 xl:p-50">
            <div className="relative min-h-56 w-full flex-1">
              <ParticleMark fit={1} className="absolute inset-0" />
            </div>
          </section>
          <div aria-hidden className="h-10 bg-(--unite-blue)" />
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
