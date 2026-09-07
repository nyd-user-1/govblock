import type { Metadata } from "next"

import { CreateWatch } from "@/components/watches/create"

export const metadata: Metadata = { title: "Create a watch" }

export default function NewWatchPage() {
  return <CreateWatch />
}
