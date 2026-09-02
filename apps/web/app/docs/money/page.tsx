import Link from "next/link"

import { DocsPage } from "@/components/docs-page"

// Finance. Four places in the site have linked here since the rail was
// written — the directory rail, the home navigation card, and the next-page
// arrows on /docs/directory and /docs/laws — and the page did not exist, so
// every one of them 404'd and the router prefetched a 404 on the home page.
//
// The page exists now and it says what WE lack rather than nothing at all.
// That is the rule this section earned the hard way: a surface that renders
// nothing hides the todo, and a link that 404s hides it twice — the reader
// learns only that something is broken, never what is missing.
//
// What is actually missing is a list. Both money readers on the record —
// `getLobbying(bill)` and `getFec(member)` — answer for ONE bill or ONE member,
// which is why the money shows up on those pages and cannot yet be a page of
// its own. A Finance surface needs a list query that does not exist, and
// writing it is a decision about the data layer rather than about this page.

const title = "Finance"
const description =
  "What we hold on money in politics, where it surfaces today, and the piece that is missing."

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
      <p>
        <strong>This page is not built yet.</strong> It is here because four
        places in the site link to it, and a link that 404s tells a reader less
        than a page that says what is missing.
      </p>

      <h2>What we hold</h2>
      <p>
        Two federal records, both loaded and both queryable — one bill or one
        member at a time:
      </p>
      <ul>
        <li>
          <strong>Senate LDA lobbying</strong> — 560,789 filing rows joinable to
          a bill. Every one lands on a federal bill, so this is Congress&apos;s
          register and not a per-state one.
        </li>
        <li>
          <strong>FEC totals</strong> — 5,517 rows across 726 members of
          Congress.
        </li>
      </ul>

      <h2>Where the money already shows</h2>
      <p>
        On the record itself, which is where it means something. A federal
        bill&apos;s page carries the lobbying filed against it, a member&apos;s
        page carries their FEC totals, and the{" "}
        <Link href="/agents/money-follower">Money Follower</Link> reads both and
        says out loud where it cannot see — a state bill has no federal filings
        and the agent names that rather than answering with silence.
      </p>

      <h2>What is missing</h2>
      <p>
        A list. Both readers answer for a single bill or a single member, so
        there is nothing yet to rank, total or page through — a Finance surface
        needs a query that returns many rows, and that is a decision about the
        data layer rather than about this page. Until it exists this page stays
        as it is, visibly unfinished, rather than dressing the two lookups up as
        a section.
      </p>
    </DocsPage>
  )
}
