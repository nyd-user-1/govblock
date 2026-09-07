import type { Metadata } from "next"

import { WatchPage } from "@/components/watches/watch-page"

export const metadata: Metadata = { title: "Watch" }

export default async function OneWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WatchPage id={id} />
}
