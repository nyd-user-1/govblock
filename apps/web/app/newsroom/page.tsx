import type { Metadata } from "next"

import newsroom from "@/lib/data/newsroom-us.json"
import desks from "@/lib/data/stream-desks.json"
import * as F from "@/lib/fixtures"
import { NewsroomPage, type Newsroom } from "@/components/newsroom"

// Ported from livingston-v3 app/(app)/newsroom/page.tsx. Congress is the desk.
export const metadata: Metadata = { title: "News Room", description: "What the legislature did, newest first." }

export default function Newsroom() {
  return <NewsroomPage data={newsroom as unknown as Newsroom} state={F.STATE} session={F.SESSION} others={desks} />
}
