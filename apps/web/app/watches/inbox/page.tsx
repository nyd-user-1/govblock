import type { Metadata } from "next"

import { WatchInbox } from "@/components/watches/inbox"

export const metadata: Metadata = { title: "Inbox" }

export default function InboxPage() {
  return <WatchInbox />
}
