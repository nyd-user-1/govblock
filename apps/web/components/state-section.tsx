import { DOCS_COLUMN, DocsHeader } from "@/components/docs-header"
import { JURISDICTIONS_SECTION_ID } from "@/components/root-sections"
import { StateTable } from "@/components/state-table"
import { JURISDICTIONS_TABLE } from "@/lib/jurisdictions"

// /state's head and table, said once: the page draws them in DocsPage, and the
// root draws them as its second section (Brendan, 2026-09-20), under the hero,
// where the hero's down arrow lands. Both from the frozen counts, so neither
// asks the database anything: the section two before this one counted the
// record on every load, and against a paused cluster the root answered 500.
const bills = JURISDICTIONS_TABLE.reduce((total, row) => total + row.bills, 0)

export const STATE_PAGE = {
  title: "Jurisdictions",
  description: `${JURISDICTIONS_TABLE.length} legislatures · ${bills.toLocaleString("en-US")} bills`,
  slug: "/state",
  next: { name: "Bills", url: "/bills" },
}

export function StateSection() {
  return (
    <section id={JURISDICTIONS_SECTION_ID} className={`${DOCS_COLUMN} pb-16 text-[1.05rem] sm:text-[15px]`}>
      <DocsHeader {...STATE_PAGE} />
      <div className="typeset w-full">
        <StateTable rows={JURISDICTIONS_TABLE} />
      </div>
    </section>
  )
}
