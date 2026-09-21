import type { Metadata } from "next"

import { DocsPage } from "@/components/docs-page"
import { STATE_PAGE } from "@/components/state-section"
import { StateTable } from "@/components/state-table"
import { JURISDICTIONS_TABLE } from "@/lib/jurisdictions"

// /state (Brendan, 2026-09-13): every jurisdiction on one page, with the door
// to each hub. The table is components/state-table.tsx, shared with the root
// page's second section since 2026-09-18.
//
// On the records shell since the same day (Brendan): DocsPage's head, center
// column and right rail, under the docs layout's left rail. The site rail
// does not list /state, so the head's arrow goes to Bills.
//
// From the frozen counts (Brendan, 2026-09-20): the four whole-table counts
// the page ran each hour are scripts/jurisdictions/freeze.mjs's now, and the
// page and the root's second section (components/state-section.tsx) say the
// same head over the same rows.
export const metadata: Metadata = { title: "Jurisdictions", description: "Every legislature on the record: its bills, laws and members." }

export default function StateIndexPage() {
  return (
    <DocsPage {...STATE_PAGE}>
      <StateTable rows={JURISDICTIONS_TABLE} />
    </DocsPage>
  )
}
