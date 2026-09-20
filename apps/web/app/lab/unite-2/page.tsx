import type { Metadata } from "next"

import { Unite2 } from "@/components/unite-2"

import "./unite.css"

// /unite-2 (Brendan, 2026-09-11): the ecosystem landing page under the
// particle scroller. Its body below the hero is the root page's too
// (Brendan, 2026-09-14); /unite, the sandbox it was forked from, is gone.
export const metadata: Metadata = {
  title: "Unite",
  description:
    "A conversation between Americans in every congressional district, on open infrastructure for the record of American government.",
}

export default function Unite2Page() {
  return <Unite2 />
}
