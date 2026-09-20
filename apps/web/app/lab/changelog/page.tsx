import * as F from "@/lib/fixtures"
import { getStream, scopeStates } from "@/lib/policy/stream"
import { ChangelogBody, type Entry } from "@/components/changelog-body"

// Ported from livingston-v3 app/(app)/docs/changelog/page.tsx: bills as they
// move, across jurisdictions, in the changelog's own layout. Congress is
// prerendered from mv_stream_latest hourly; the body picks up the jurisdiction
// in scope on the client, so the route stays static.
export const metadata = { title: "Changelog", description: "Latest updates and announcements." }
export const revalidate = 3600

export default async function ChangelogPage() {
  const { groups } = await getStream({ states: scopeStates(F.STATE), limit: 40 })
  const entries: Entry[] = groups
    .flatMap((group) => group.bills.map((bill) => ({ ...bill, state: group.state, session: group.session })))
    .sort((a, b) => ((a.last_action_date ?? "") < (b.last_action_date ?? "") ? 1 : -1))

  return <ChangelogBody initial={entries} initialState={F.STATE} />
}
