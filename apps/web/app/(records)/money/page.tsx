import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { FinanceList } from "@/components/policy/finance-list"

// Finance. Until 2026-09-02 this page said "not built yet", because both money
// readers on the record — `getLobbying(bill)` and `getFec(member)` — answer
// for one bill or one member and there was no list to draw. There is one list
// we hold: the FEC's candidate summaries for the 400 largest accounts of the
// cycle, the same extract the FEC explorer block reads. It is drawn here as
// the canon item, and the page says what the extract is rather than dressing
// it up as every candidate.
//
// Lobbying has its own explorer since 2026-09-07 — /lobbying, with the
// firms, the clients, the lobbyists and a page for each — so this page names it
// rather than saying it does not exist.

const title = "Finance"
const description = "Campaign money by candidate, from the FEC, and the federal lobbying register."

export const metadata = { title, description }

export default function MoneyPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/money"
      previous={{ name: "Laws", url: "/public-laws" }}
      next={{ name: "Bills", url: "/bills" }}
    >
      <FinanceList />

      <h2>What we hold</h2>
      <p>
        <strong>FEC candidate summaries</strong> — receipts, disbursements and
        cash on hand for the 400 largest accounts of the 2025–2026 cycle, listed
        above. A member&apos;s page carries their own FEC totals.
      </p>
      <p>
        <strong>Senate LDA lobbying</strong> — every quarterly filing under the
        Lobbying Disclosure Act, keyed to congress.gov&apos;s own bills.{" "}
        <Link href="/lobbying">Lobbying</Link> is the explorer: the firms,
        the clients, the named lobbyists and the issue codes, each with a page
        of its own. It also reads on each federal bill, member and committee,
        and the <Link href="/agents/money-follower">Treasurer</Link> reads both
        records and says where it cannot see.
      </p>

      <h2>What is missing</h2>
      <p>
        Money at the level of a bill. An LDA filing reports one registrant&apos;s
        income from one client for everything they worked that quarter, and the
        statute asks for no breakdown by issue or by bill, so no honest figure
        exists for what was spent on any one measure. Every dollar shown is a
        whole filing&apos;s, and is labelled as one.
      </p>
    </DocsPage>
  )
}
