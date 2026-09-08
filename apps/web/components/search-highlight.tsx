import * as React from "react"

import { highlightParts } from "@/lib/search-match"
import { cn } from "@govblock/ui/lib/utils"

// One mark, so a hit found in a bill's text and a hit found in its number are
// drawn the same. /search had highlighting only inside the Text snippets, where
// Postgres does the finding; every other group showed the reader a row and left
// them to spot the word themselves (Brendan, 2026-09-08).
//
// No "use client": both the server lists and the client ones render this.

export function Mark({ children, className }: { children: React.ReactNode; className?: string }) {
  return <mark className={cn("rounded-[2px] bg-primary/15 px-0.5 text-foreground", className)}>{children}</mark>
}

/** `text`, with every stretch the query hit under a mark. */
export function Highlight({ text, query, className }: { text: string | null | undefined; query: string; className?: string }) {
  const parts = React.useMemo(() => highlightParts(text, query), [text, query])
  if (!parts.some((part) => part.hit)) return <>{text ?? ""}</>
  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          <Mark key={index} className={className}>
            {part.text}
          </Mark>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        )
      )}
    </>
  )
}
