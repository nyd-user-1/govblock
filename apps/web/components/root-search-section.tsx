"use client"

import { ArrowDownIcon } from "lucide-react"
import { MotionConfig, motion } from "motion/react"

import { HomeSearch } from "@/components/home/home-search"
import { JURISDICTIONS_SECTION_ID, SEARCH_SECTION_ID } from "@/components/root-sections"

// The root's section two (Brendan, 2026-09-21): the account home's greeting
// and its search — the bar that opens the site's ⌘K dialog, the searches to
// try under it — a screen of its own, where the hero's down arrow lands. Its
// own arrow, the hero's circle again, goes on to section three, Jurisdictions.
export function RootSearchSection() {
  return (
    <section id={SEARCH_SECTION_ID} className="mx-auto flex min-h-[calc(100svh-var(--header-height))] w-full max-w-5xl scroll-mt-0 flex-col items-center justify-center gap-8 px-4 py-16 md:px-6">
      <h2 className="text-3xl font-semibold tracking-tight">Building today?</h2>
      <HomeSearch />
      <MotionConfig reducedMotion="user">
        <motion.button
          type="button"
          aria-label="Scroll to Jurisdictions"
          onClick={() => document.getElementById(JURISDICTIONS_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" })}
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
