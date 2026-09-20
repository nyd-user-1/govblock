import * as F from "@/lib/fixtures"
import { getStream, scopeStates } from "@/lib/policy/stream"
import { codeBlockTexts } from "@/lib/typeset/printed-text"
import { ChangelogIndex, ChangelogProvider, ChangelogRss, ChangelogSteps, type Entry } from "@/components/changelog-v2-body"
import { DocsPage } from "@/components/docs-page"

// Ported from livingston-v3 app/(app)/docs/changelog-v2/page.tsx: the bill
// stream as the docs' installation steps — one step per bill as it moves, the
// action as the step, the text as the titled code block beneath. Congress is
// prerendered hourly; the body follows the scope on the client. On the docs
// shell since 2026-09-20 (Brendan): the steps in the center container, their
// index in the right rail.
const title = "Changelog"
const description = "Latest updates and announcements."

export const metadata = { title, description }
export const revalidate = 3600

const PER_STREAM = 12

export default async function ChangelogPage() {
  const { groups } = await getStream({ states: scopeStates(F.STATE), limit: PER_STREAM })
  const entries: Entry[] = groups
    .flatMap((group) => group.bills.map((bill) => ({ ...bill, state: group.state, session: group.session })))
    .sort((a, b) => ((a.last_action_date ?? "") < (b.last_action_date ?? "") ? 1 : -1))
  // Printed the way every code block prints bill text (2026-09-15): the XML where it reads cleanly.
  const texts = await codeBlockTexts(entries.map((bill) => Number(bill.bill_id)))

  return (
    <ChangelogProvider initial={entries} initialTexts={Object.fromEntries([...texts].map(([id, text]) => [String(id), text]))}>
      <DocsPage title={title} description={description} slug="/changelog" previous={{ name: "Bookmarks", url: "/bookmarks" }} next={{ name: "Favorites", url: "/favorites" }} actions={<ChangelogRss />} rail={<ChangelogIndex />} publicRail={false}>
        <ChangelogSteps />
      </DocsPage>
    </ChangelogProvider>
  )
}
