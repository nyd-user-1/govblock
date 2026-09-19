"use client"

import * as React from "react"

import { Mark } from "@/components/search-highlight"
import { RecordList } from "@/components/policy/record-item"

// A search's result groups, as /search draws them, shared with the root page's
// national search since 2026-09-18.

// ts_headline wraps the match in « », not in HTML — nothing has to trust markup
// coming out of the database. A snippet is therefore split on the guillemets and
// the odd pieces are the hits. (A bill that itself contains a « would show a
// stray highlight; across 3.3 M documents that is a better trade than
// dangerouslySetInnerHTML.)
export function Snippet({ text }: { text: string }) {
  const pieces = text.split(/[«»]/)
  return (
    <span className="min-w-0 flex-1 text-muted-foreground">
      {pieces.map((piece, i) =>
        i % 2 ? (
          <Mark key={i}>{piece}</Mark>
        ) : (
          <React.Fragment key={i}>{piece}</React.Fragment>
        )
      )}
    </span>
  )
}

// The section's bordered box and its `divide-y` are gone: the canon puts a 1 px
// rule on the item itself, and a box around a list of ruled items draws the same
// line twice and boxes it as well.
export function SearchSection({ id, title, count, note, children }: { id: string; title: string; count: number; /** A line under the heading: why a group came back empty. */ note?: React.ReactNode; children: React.ReactNode }) {
  if (!count && !note) return null
  return (
    // scroll-mt clears the sticky header, so the rail's jump lands on the
    // heading rather than a hand's width above it.
    <section id={id} className="flex scroll-mt-[calc(var(--header-height)+2rem)] flex-col">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="tabular-nums">({count})</span>
      </h2>
      {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
      {count > 0 && <RecordList className="mt-2 mb-2">{children}</RecordList>}
    </section>
  )
}
