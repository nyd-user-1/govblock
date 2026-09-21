import type { Metadata } from "next"

import { DocsPage } from "@/components/docs-page"
import { CreateWatch } from "@/components/watches/create"

export const metadata: Metadata = { title: "Create a watch" }

// On the docs shell (Brendan, 2026-09-20): the flow's label is the shell's
// title, and the card and its steps sit in the shell's column.
export default function NewWatchPage() {
  return (
    <DocsPage title="Create a watch" description="Track a bill, watch a committee, start from a template or build your own: pick what to watch and what should happen." slug="/watches/new" previous={{ name: "Watches", url: "/watches" }} next={{ name: "Inbox", url: "/watches/inbox" }}>
      <CreateWatch />
    </DocsPage>
  )
}
