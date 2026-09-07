import type { Metadata } from "next"

import { WatchesList } from "@/components/watches/watches-list"

export const metadata: Metadata = { title: "Watches", description: "What the record does, told to you the way you asked." }

export default function WatchesPage() {
  return <WatchesList />
}
