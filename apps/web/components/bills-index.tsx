import { BillsViews } from "@/components/bills-views"
import { DOCS_COLUMN, DOCS_DESCRIPTION } from "@/components/docs-header"
import { BILLS_SECTION_ID } from "@/components/root-sections"

// /bills (Brendan, 2026-09-11): the jurisdictions, each a flag card opening its
// own bills page — /bills/us, /bills/ny — since the record is scoped per
// jurisdiction and one list under "the jurisdiction in scope" hid that.
export const BILLS_PAGE = {
  title: "Bills",
  description: "Every jurisdiction with a record: Congress, the fifty states and the District, each with its bills and their full text.",
  slug: "/bills",
  next: { name: "Amendments", url: "/amendments" },
}

// The line under "Scope": the whole record's size (Brendan, 2026-09-18; law in
// sections). Off the database (Brendan, 2026-09-20): the three counts ran on
// every load, and against a paused cluster the root page hung past Amplify's
// 30 seconds and answered 500. The figures are the ones counted on 2026-09-18;
// getRecordCounts (lib/policy/state-index.ts) is still there to re-attach.
const RECORD_LINE = "2.1M Bills, 1.9M Sections of Law, and 21.7K Legislators"

/**
 * The root page's second section (Brendan, 2026-09-18): /bills's layout,
 * between the hero and the rest, with the cards and /state's table a button
 * apart (components/bills-views.tsx). Titled Scope, the rail's name for
 * /bills, with the record's counts under it. Copy Page keeps /bills's sentence.
 */
export function BillsSection() {
  const lead = <p className={DOCS_DESCRIPTION}>{RECORD_LINE}</p>
  return (
    <section id={BILLS_SECTION_ID} className={`${DOCS_COLUMN} text-[1.05rem] sm:text-[15px]`}>
      <BillsViews page={{ ...BILLS_PAGE, title: "Scope" }} lead={lead} />
    </section>
  )
}
