"use client"

import * as React from "react"

import { JURISDICTIONS_SECTION_ID, SEARCH_SECTION_ID } from "@/components/root-sections"

const SECTIONS = [SEARCH_SECTION_ID, JURISDICTIONS_SECTION_ID]
// /#search was the search section's first anchor, for an hour; it still opens it.
const sectionOf = (hash: string) => (hash === "search" ? SEARCH_SECTION_ID : hash)

// The root's anchors (Brendan, 2026-09-21): /#searchbar and /#jurisdictions open the page on their section, where
// the arrows land — typed, followed, or come back to with Back, since an arrow's click leaves its hash in the
// history (goToSection, components/root-sections.ts). The browser's own jump to a fragment is not enough here: the
// page scrolls inside the particle scroller's box, and where HTML-in-Canvas runs that box is mounted a second time,
// inside the canvas, after the jump — back at the top. This sits inside the box, so it mounts with it each time
// and scrolls again. Back from a section to the bare address goes up to the hero, as it would from an anchor.
export function RootHashScroll() {
  React.useEffect(() => {
    const land = (behavior: ScrollBehavior) => {
      const hash = window.location.hash.slice(1)
      if (!hash) return behavior === "smooth" ? document.querySelector("[data-page-scroller]")?.scrollTo({ top: 0, behavior }) : undefined
      const id = sectionOf(hash)
      if (SECTIONS.includes(id)) document.getElementById(id)?.scrollIntoView({ behavior, block: "start" })
    }
    land("instant")
    const onHash = () => land("smooth")
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  return null
}
