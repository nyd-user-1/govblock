import { Suspense } from "react"

import { BillsViews } from "@/components/bills-views"
import { DOCS_COLUMN, DOCS_DESCRIPTION } from "@/components/docs-header"
import { getRecordCounts } from "@/lib/policy/state-index"
import { BILLS_SECTION_ID } from "@/components/root-sections"
import { Skeleton } from "@govblock/ui/components/ny4/skeleton"

// /bills (Brendan, 2026-09-11): the jurisdictions, each a flag card opening its
// own bills page — /bills/us, /bills/ny — since the record is scoped per
// jurisdiction and one list under "the jurisdiction in scope" hid that.
export const BILLS_PAGE = {
  title: "Bills",
  description: "Every jurisdiction with a record: Congress, the fifty states and the District, each with its bills and their full text.",
  slug: "/bills",
  next: { name: "Amendments", url: "/amendments" },
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

// The line under "Scope": the whole record's size, "2.1M Bills, 1.9M Sections of
// Law, and 21.7K Legislators" (Brendan, 2026-09-18; law in sections, see
// getRecordCounts). A failed count falls back to /bills's sentence rather than
// taking the root page down with it.
async function RecordLine() {
  const counts = await getRecordCounts().catch(() => null)
  if (!counts) return <p className={DOCS_DESCRIPTION}>{BILLS_PAGE.description}</p>
  return (
    <p className={DOCS_DESCRIPTION}>
      {compact.format(counts.bills)} Bills, {compact.format(counts.sections)} Sections of Law, and {compact.format(counts.legislators)} Legislators
    </p>
  )
}

/**
 * The root page's second section (Brendan, 2026-09-18): /bills's layout,
 * between the hero and the rest, with the cards and /state's table a button
 * apart (components/bills-views.tsx). Titled Scope, the rail's name for
 * /bills, with the record's counts under it; they stream in behind a line of
 * skeleton so the page never waits on them. Copy Page keeps /bills's sentence.
 */
export function BillsSection() {
  const lead = (
    <Suspense fallback={<div className="flex h-6 items-center"><Skeleton className="h-4 w-80 max-w-full" /></div>}>
      <RecordLine />
    </Suspense>
  )
  return (
    <section id={BILLS_SECTION_ID} className={`${DOCS_COLUMN} text-[1.05rem] sm:text-[15px]`}>
      <BillsViews page={{ ...BILLS_PAGE, title: "Scope" }} lead={lead} />
    </section>
  )
}
