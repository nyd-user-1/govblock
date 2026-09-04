import type { Metadata } from "next"

import { LawsBrowser } from "@/components/laws/laws-browser"

export const metadata: Metadata = {
  title: "Laws of New York — govblock",
  description: "The Consolidated Laws of the State of New York, the Constitution, the unconsolidated laws, the court acts and the rules — every section, searchable.",
}

// The law itself, free to read and to search. Brendan, 2026-09-04: "you had
// to pay to see the law? Give me a break."
export default function LawsPage() {
  return (
    <div className="flex h-[calc(100vh-var(--header-height))] min-h-0 flex-col p-4 md:p-6">
      <LawsBrowser />
    </div>
  )
}
