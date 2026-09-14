"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { usePaneNotes } from "@/lib/typeset/pane-note"
import { TYPESET_VIEWS, typesetHref, type TypesetView } from "@/lib/typeset/views"
import { Button } from "@govblock/ui/components/ny4/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// The Git view's footer, in parts (2026-09-14), so the bill's views and the
// pages without a bill (the Library, a Work, a fork) wear the same one: the
// numbered pills, Getting started, and the line the pane hands the footer.

/** The footer's numbered pills for a bill's views, each a link. */
export function ViewPills({ billId, view }: { billId: number; view: TypesetView | null }) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-1">
      {TYPESET_VIEWS.map((option, index) => (
        <Tooltip key={option.key}>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                data-active={view === option.key || (option.key === "git" && view === "fork")}
                className="h-7 min-w-7 cursor-pointer rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                onClick={() => router.push(typesetHref(billId, option.key))}
              />
            }
          >
            {String(index + 1).padStart(2, "0")}
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={10}>
            {option.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

/** The lines a pane hands the footer: the file's size, then which printing and its address. */
export function PaneNoteSlot() {
  const notes = usePaneNotes()
  return (
    <>
      {notes.map(({ key, note }) => (
        <React.Fragment key={key}>
          <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />
          {note}
        </React.Fragment>
      ))}
    </>
  )
}

/** Getting started, where Open in New Tab stood (Brendan, 2026-09-13). */
export function GettingStarted() {
  return (
    <Button asChild variant="ghost" size="sm" className="h-7 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
      <Link href="/docs">Getting started</Link>
    </Button>
  )
}
