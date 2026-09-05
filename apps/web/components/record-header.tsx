import * as React from "react"

// The head of every record page — a member, a bill, a subject: the emblem at
// the left (a portrait, a seal), the name, a muted line of facts under it,
// and the page's controls at the right. One markup for all of them (Brendan,
// 2026-09-05: "I need the logo before the bill like it is before the
// member"). The member page drew it first; the others take it as it is.

/** The emblem's size: the name's line and the facts line together, so it stands no taller than the text beside it (Brendan, 2026-09-05). */
export const RECORD_MEDIA = 60

export function RecordHeader({
  media,
  title,
  meta,
  action,
}: {
  /** The portrait or the seal, at RECORD_MEDIA. */
  media?: React.ReactNode
  title: React.ReactNode
  /** The facts under the name, joined by dots: seat · party · chamber. Nothing longer belongs here; a bill's title goes in its first sentence. */
  meta?: React.ReactNode[]
  /** Copy Page and the arrows, top-aligned with the name. */
  action?: React.ReactNode
}) {
  const facts = (meta ?? []).filter((item) => item !== null && item !== undefined && item !== false && item !== "")
  return (
    <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:gap-6">
      {media}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {facts.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {facts.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span>•</span>}
                <span className="inline-flex items-center gap-1.5">{item}</span>
              </React.Fragment>
            ))}
          </p>
        )}
      </div>
      {action && <div className="docs-nav hidden shrink-0 items-center gap-2 sm:flex">{action}</div>}
    </header>
  )
}
