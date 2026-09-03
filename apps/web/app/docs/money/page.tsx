import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { FinanceList } from "@/components/policy/finance-list"

// Finance. Until 2026-09-02 this page said "not built yet", because both money
// readers on the record — `getLobbying(bill)` and `getFec(member)` — answer
// for one bill or one member and there was no list to draw. There is one list
// we hold: the FEC's candidate summaries for the 400 largest accounts of the
// cycle, the same extract the FEC explorer block reads. It is drawn here as
// the canon item, and the page says what the extract is rather than dressing
// it up as every candidate. Lobbying still has no list; it reads on each
// federal bill's page, and that is said below rather than hidden.

const title = "Finance"
const description = "Campaign money by candidate, from the FEC. Lobbying reads on each bill's page."

export const metadata = { title, description }

export default function MoneyPage() {
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/docs/money"
      previous={{ name: "Laws", url: "/docs/laws" }}
      next={{ name: "Bills", url: "/docs/bills" }}
    >
      <FinanceList />

      <h2>What we hold</h2>
      <p>
        <strong>FEC candidate summaries</strong> — receipts, disbursements and
        cash on hand for the 400 largest accounts of the 2025–2026 cycle, listed
        above. A member&apos;s page carries their own FEC totals.
      </p>
      <p>
        <strong>Senate LDA lobbying</strong> — 560,789 filing rows joinable to a
        federal bill. It reads on the bill&apos;s page, and the{" "}
        <Link href="/agents/money-follower">Money Follower</Link> reads both
        records and says where it cannot see.
      </p>

      <h2>What is missing</h2>
      <p>
        A lobbying list. The filings answer for one bill at a time, so there is
        nothing yet to rank or page through across bills; that needs a query the
        data layer does not have, and this page will say so until it does.
      </p>
    </DocsPage>
  )
}
