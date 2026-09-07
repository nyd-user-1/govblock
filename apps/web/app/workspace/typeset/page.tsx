import { type Metadata } from "next"
import { Suspense } from "react"

import { TypesetSkeleton } from "@/app/(typeset)/components/typeset-skeleton"
import { TypesetHistoryProvider } from "@/app/(typeset)/hooks/use-history"
import { LocksProvider } from "@/app/(typeset)/hooks/use-locks"
import { TypesetWorkspacePage } from "@/components/workspace/typeset-workspace"

// /workspace/typeset — typeset in the shell (Brendan, 2026-09-07). The
// providers are the ones the old /typeset layout wrapped its page in:
// TypesetHistoryProvider reads useSearchParams(), so it sits under Suspense
// with the page's skeleton as the fallback.
export const metadata: Metadata = { title: "Typeset", description: "Typography for markdown you don't control." }

export default function WorkspaceTypesetPage() {
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
