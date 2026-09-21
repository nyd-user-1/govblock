import * as React from "react"

import { DOCS_DESCRIPTION } from "@/components/docs-header"

// The head of every record page — a member, a bill, a subject: the emblem at
// the left (a portrait, a seal), the name, a muted line of facts under it,
// and the page's controls at the right. One markup for all of them (Brendan,
// 2026-09-05: "I need the logo before the bill like it is before the
// member"). The member page drew it first; the others take it as it is.
//
// The docs shell's header block, with or without a seal (Brendan, 2026-09-20):
// that is the only variant. The seal is off unless a page asks for it — the
// member page does, and a department's, whose seal or logo came back the same
// day — and the facts line wears the shell's
// sub-header: its size, colour and width (DOCS_DESCRIPTION).

/** The emblem's size: the name's line and the facts line together, so it stands no taller than the text beside it (Brendan, 2026-09-05). */
export const RECORD_MEDIA = 60

/** A flag before the name (a jurisdiction's hub, 2026-09-20): the seal's width, so two-thirds its height. As tall as the seal it stood half again as wide, and too big (Brendan, the same day). */
export const RECORD_FLAG = RECORD_MEDIA

/**
 * The facts under the name, joined by dots. Apart from RecordHeader since
 * 2026-09-20, when the record pages moved onto DocsPage (Brendan): the shell
 * draws the head, and this is what a record hands it as its sub-header.
 */
export function RecordFacts({ meta }: { meta?: React.ReactNode[] }) {
  const facts = (meta ?? []).filter((item) => item !== null && item !== undefined && item !== false && item !== "")
  if (facts.length === 0) return null
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${DOCS_DESCRIPTION}`}>
      {facts.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span>•</span>}
          <span className="inline-flex items-center gap-1.5">{item}</span>
        </React.Fragment>
      ))}
    </p>
  )
}

export function RecordHeader({
  media,
  seal = false,
  title,
  meta,
  action,
}: {
  /** The portrait or the seal, at RECORD_MEDIA. Drawn only with `seal`. */
  media?: React.ReactNode
  /** The variant with the emblem before the name. */
  seal?: boolean
  title: React.ReactNode
  /** The facts under the name, joined by dots: seat · party · chamber. Nothing longer belongs here; a bill's title goes in its first sentence. */
  meta?: React.ReactNode[]
  /** Copy Page and the arrows, top-aligned with the name. */
  action?: React.ReactNode
}) {
  // The rule under the header is part of it (Brendan, 2026-09-18), so its
  // distance from the name is the same on every page: the header's 24px, then
  // the column's gap.
  return (
    <>
      <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:gap-6">
        {seal && media}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="scroll-m-24 text-3xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <RecordFacts meta={meta} />
        </div>
        {action && (
          <div className="docs-nav hidden shrink-0 items-center gap-2 sm:flex">
            {action}
          </div>
        )}
      </header>
      <hr className="border-0 border-t border-border" />
    </>
  )
}
