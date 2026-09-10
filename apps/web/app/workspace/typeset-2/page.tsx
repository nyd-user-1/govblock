import { type Metadata } from "next"
import { Suspense } from "react"

import { TypesetSkeleton } from "@/app/(typeset)/components/typeset-skeleton"
import { TypesetHistoryProvider } from "@/app/(typeset)/hooks/use-history"
import { LocksProvider } from "@/app/(typeset)/hooks/use-locks"
import { TypesetWorkspacePage } from "@/components/workspace/typeset-workspace-2"

// /workspace/typeset-2 — a duplicate of /workspace/typeset (Brendan,
// 2026-09-09), on its own copy of the workspace component. The
// providers are the ones the old /typeset layout wrapped its page in:
// TypesetHistoryProvider reads useSearchParams(), so it sits under Suspense
// with the page's skeleton as the fallback.
export const metadata: Metadata = { title: "Typeset 2", description: "Typography for markdown you don't control." }

export default function WorkspaceTypeset2Page() {
  return (
    <LocksProvider>
      <Suspense fallback={<TypesetSkeleton />}>
        <TypesetHistoryProvider>
          <TypesetWorkspacePage />
        </TypesetHistoryProvider>
      </Suspense>
    </LocksProvider>
  )
}
