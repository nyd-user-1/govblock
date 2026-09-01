import * as F from "@/lib/fixtures"
import { getStream, scopeStates } from "@/lib/policy/stream"
import { getBillTexts } from "@/lib/policy/texts"
import { ChangelogV2Body, type Entry } from "@/components/changelog-v2-body"

// Ported from livingston-v3 app/(app)/docs/changelog-v2/page.tsx: the bill
// stream as the docs' installation steps — one step per bill as it moves, the
// action as the step, the text as the titled code block beneath. Congress is
// prerendered hourly; the body follows the scope on the client.
export const metadata = { title: "Changelog", description: "Latest updates and announcements." }
export const revalidate = 3600

const PER_STREAM = 12

export default async function ChangelogV2Page() {
  const { groups } = await getStream({ states: scopeStates(F.STATE), limit: PER_STREAM })
  const entries: Entry[] = groups
    .flatMap((group) => group.bills.map((bill) => ({ ...bill, state: group.state, session: group.session })))
    .sort((a, b) => ((a.last_action_date ?? "") < (b.last_action_date ?? "") ? 1 : -1))
  const texts = await getBillTexts(entries.map((bill) => Number(bill.bill_id)))

  return (
    <ChangelogV2Body
      initial={entries}
      initialTexts={Object.fromEntries([...texts].map(([id, text]) => [String(id), text]))}
      initialState={F.STATE}
    />
  )
}
