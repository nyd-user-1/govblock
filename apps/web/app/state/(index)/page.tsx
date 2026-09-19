import type { Metadata } from "next"

import { DocsPage } from "@/components/docs-page"
import { getStateIndex } from "@/lib/policy/state-index"
import { StateTable } from "@/components/state-table"

// /state (Brendan, 2026-09-13): every jurisdiction on one page, with the door
// to each hub. The table is components/state-table.tsx, shared with the root
// page's second section since 2026-09-18.
//
// On the records shell since the same day (Brendan): DocsPage's head, center
// column and right rail, under the docs layout's left rail. The site rail
// does not list /state, so the head's arrow goes to Bills.
export const revalidate = 3600
export const metadata: Metadata = { title: "Jurisdictions", description: "Every legislature on the record: its bills, laws and members." }

export default async function StateIndexPage() {
  const rows = await getStateIndex()
  const totalBills = rows.reduce((t, r) => t + r.bills, 0)
  return (
    <DocsPage title="Jurisdictions" description={`${rows.length} legislatures · ${totalBills.toLocaleString()} bills`} slug="/state" next={{ name: "Bills", url: "/bills" }}>
      <StateTable rows={rows} />
    </DocsPage>
  )
}
