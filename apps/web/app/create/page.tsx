import type { Metadata } from "next"

import { CreateRedirect } from "@/components/workspace/create-redirect"

// /create is retired (Brendan, 2026-09-07). Every address it served has a
// path under /workspace; a link that still says /create is sent there.
export const metadata: Metadata = { title: "Data", description: "Moved to the workspace." }

export default function CreatePage() {
  return <CreateRedirect />
}
