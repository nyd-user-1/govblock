import { WIDE_COLUMN } from "@/components/wide-page"
import { JURISDICTIONS_SECTION_ID } from "@/components/root-sections"
import { StateTable } from "@/components/state-table"
import { JURISDICTIONS_TABLE } from "@/lib/jurisdictions"

// /state's head and table, said once: the page draws them in DocsPage, and the
// root draws the table as its third section (Brendan, 2026-09-20), where the
// search section's arrow lands — under a head of its own since 2026-09-22, the
// count of rows on file over "Records from all 50 States and Congress", in
// section two's style, in place of the docs head. Both from the frozen counts,
// so neither asks the database anything: the section two before this one
// counted the record on every load, and against a paused cluster the root
// answered 500.
const bills = JURISDICTIONS_TABLE.reduce((total, row) => total + row.bills, 0)

export const STATE_PAGE = {
  title: "Jurisdictions",
  description: `${JURISDICTIONS_TABLE.length} legislatures · ${bills.toLocaleString("en-US")} bills`,
  slug: "/state",
  next: { name: "Bills", url: "/bills" },
}

export function StateSection() {
  return (
    // The top padding is section two's (Brendan, 2026-09-21): the arrow lands the h1's top level with the rails' tabs', 200px down the window.
    // The column is section two's too, the account home's 64rem rather than the docs page's 40rem (Brendan, 2026-09-22).
    <section id={JURISDICTIONS_SECTION_ID} className={`${WIDE_COLUMN} pt-[calc(200px-var(--header-height))] pb-16 text-[1.05rem] sm:text-[15px] lg:pt-[calc(200px-var(--header-height))]`}>
      <div className="flex flex-col items-center gap-3 pb-2 text-center">
        <h2 className="text-4xl font-bold tracking-tight">168,336,672</h2>
        <p className="text-xl tracking-tight text-muted-foreground">Records from all 50 States and Congress</p>
      </div>
      <div className="typeset w-full">
        <StateTable rows={JURISDICTIONS_TABLE} />
      </div>
    </section>
  )
}
