import type { Metadata } from "next"

import members from "@/lib/data/members-us.json"
import * as F from "@/lib/fixtures"
import { getStateCounts } from "@/lib/policy/states"
import { getStream } from "@/lib/policy/stream"
import { Designer } from "@/components/create/designer"

// /create — livingston-v3's designer, with one component: the card, in three
// versions. Bills come from mv_stream_latest for every jurisdiction; members
// and committees are Congress's for now.
export const metadata: Metadata = { title: "New Project", description: "Compose a bill, member or committee card, filtered to a jurisdiction, and take the code." }
export const revalidate = 3600

export default async function CreatePage() {
  const [{ groups }, states] = await Promise.all([getStream({ limit: 40 }), getStateCounts()])
  const bills = groups.flatMap((g) => g.bills.map((b) => ({ ...b, state: g.state })))
  return <Designer bills={bills} members={members} committees={F.committeesAll} states={states} />
}
