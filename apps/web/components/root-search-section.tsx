"use client"

import { ArrowDownIcon } from "lucide-react"
import { MotionConfig, motion } from "motion/react"

import { HomeSearch } from "@/components/home/home-search"
import { JURISDICTIONS_SECTION_ID, SEARCH_SECTION_ID, goToSection } from "@/components/root-sections"

// The root's section two (Brendan, 2026-09-21): the account home's greeting
// and its search — the bar that drops the site's search from itself, the
// searches to try under it — a screen of its own, where the hero's down arrow lands. Its
// own arrow, the hero's circle again, goes on to section three, Jurisdictions.
export function RootSearchSection() {
  return (
    // The drop-down variant (Brendan, 2026-09-21): when the hero's arrow lands here the h1's top is level with the
    // rails' tabs' — they sit 200px down the window (components/rail-toggle.tsx) and the section starts under the
    // header, so the padding is the difference, and the bar follows the heading down. Section three lands the same way
    // (components/state-section.tsx). The section is a screen and a half tall, so Jurisdictions waits below the fold
    // and the list has the screen to drop into.
    <section id={SEARCH_SECTION_ID} className="mx-auto flex min-h-[calc(150svh-var(--header-height))] w-full max-w-5xl scroll-mt-0 flex-col items-center justify-start gap-8 px-4 pt-[calc(200px-var(--header-height))] pb-16 md:px-6">
      {/* The count is the database's own estimate of its rows, every table, read 2026-09-21; nothing is queried here. */}
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">One Record.</h1>
        <p className="text-lg tracking-tight">168,336,672 records.</p>
      </div>
      {/* ⌘K stays the header's dialog here: this bar is a screen down the page, and a key that focused it would scroll the reader away from where they were. */}
      <HomeSearch hotkey={false} />
      <MotionConfig reducedMotion="user">
        <motion.button
          type="button"
          aria-label="Scroll to Jurisdictions"
          onClick={() => goToSection(JURISDICTIONS_SECTION_ID)}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="mt-8 inline-flex size-10 items-center justify-center rounded-full border bg-background text-foreground shadow-md transition-colors hover:bg-muted [&_svg]:size-4"
        >
          <ArrowDownIcon />
        </motion.button>
      </MotionConfig>
    </section>
  )
}
