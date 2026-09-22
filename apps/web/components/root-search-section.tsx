"use client"

import * as React from "react"
import { ArrowDownIcon } from "lucide-react"
import { MotionConfig, motion } from "motion/react"

import { setRail } from "@/components/rail-toggle"
import { JURISDICTIONS_SECTION_ID, SEARCH_SECTION_ID, goToSection } from "@/components/root-sections"
import { SearchResults } from "@/components/search-page"

// The root's section two (Brendan, 2026-09-21): the heading and the search, a
// screen of its own, where the hero's down arrow lands. Its own arrow, the
// hero's circle again, goes on to section three, Jurisdictions.
//
// The search is /search's (Brendan, 2026-09-22), as the account home's is:
// the bar, the recent searches under it, and on Enter the sections — bills,
// text, laws, members, committees, topics, pages — down the page, the query
// in the address (/?q=). The drop-down bar and the searches to try under it
// stood here for a day.
export function RootSearchSection() {
  return (
    // When the hero's arrow lands here the h1's top is level with the rails' tabs' (Brendan, 2026-09-21) — they sit
    // 200px down the window (components/rail-toggle.tsx) and the section starts under the header, so the padding is
    // the difference, and the bar follows the heading down. Section three lands the same way
    // (components/state-section.tsx). The section is a screen and a half tall, so Jurisdictions waits below the fold
    // and the results have the screen to run into.
    // The column is the docs page's, as the hero's and section three's are (Brendan, 2026-09-22): max-w-160 and its side padding (DOCS_COLUMN, components/docs-header.tsx), not the account home's wider one.
    <section id={SEARCH_SECTION_ID} className="mx-auto flex min-h-[calc(150svh-var(--header-height))] w-full max-w-160 min-w-0 scroll-mt-0 flex-col items-center justify-start gap-8 px-4 pt-[calc(200px-var(--header-height))] pb-16 md:px-0">
      {/* The count is the database's own estimate of its rows, every table, read 2026-09-21; nothing is queried here. The words are Brendan's (2026-09-22). */}
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">One Search</h1>
        <p className="text-xl tracking-tight text-muted-foreground">More than 168,336,672 records.</p>
      </div>
      <div className="w-full">
        <React.Suspense fallback={null}>
          {/* The bar's filter icon opens the right rail, where the filters are (app/page.tsx). */}
          <SearchResults path="/" onFilter={() => setRail("right", false)} />
        </React.Suspense>
      </div>
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
