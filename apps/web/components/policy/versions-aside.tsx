"use client"

import * as React from "react"
import { format } from "date-fns"
import { CodeIcon, FileTextIcon } from "lucide-react"

import { fmtNumber } from "@/lib/format"
import { versionId } from "@/lib/policy/forks"
import type { TextVersion } from "@/components/policy/bill-text-pane"
import { Button } from "@govblock/ui/components/nova/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/nova/tooltip"
import { cn } from "@govblock/ui/lib/utils"

// The bill's versions as a sidebar (Brendan, 2026-09-13): the History tab's
// commit list relegated to the aside the Git view opens for its outline, in
// the changelog pattern the actions aside wears. One entry per version,
// newest first — the dot on the line, the day as the title over a hairline —
// and under it the printing's name, its size and its id, with the two things
// a reader does with a version: browse its text, or open what it changed.

function dayOf(v: TextVersion) {
  const raw = v.date ?? v.fetched_at
  if (!raw) return null
  const d = new Date(String(raw).length === 10 ? `${raw}T00:00:00` : raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export function VersionsList({ versions, current, onChoose, onOpenChanges }: { versions: TextVersion[]; current: number | null; onChoose: (documentId: number) => void; onOpenChanges?: (documentId: number) => void }) {
  if (!versions.length) return <p className="px-3 py-4 text-xs text-muted-foreground">No text on file for this bill yet.</p>
  return (
    <div className="relative px-3 py-4">
      <div aria-hidden className="absolute inset-y-0 start-[19.5px] w-px bg-border" />
      <div className="flex flex-col gap-y-6">
        {versions.map((v, index) => {
          const day = dayOf(v)
          const nth = String(versions.length - index).padStart(2, "0")
          const active = current === v.document_id
          return (
            <article key={v.document_id} className="relative flex items-start gap-3">
              <div className={cn("my-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-background ring ring-border", active && "ring-primary")}>
                <div className="size-2 rounded-full bg-primary" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="border-b border-border pb-2">
                  <h2 className="relative text-sm font-semibold text-pretty text-foreground">
                    {day ? <time dateTime={day.toISOString().slice(0, 10)}>{format(day, "MMMM d, yyyy")}</time> : "Date of record unknown"}
                  </h2>
                </div>
                <div className="flex flex-col gap-1 py-2 text-xs">
                  <button type="button" onClick={() => onChoose(v.document_id)} className={cn("text-left hover:underline", active && "font-medium text-foreground")}>
                    <span className="mr-2 font-mono text-muted-foreground">{nth}</span>
                    {v.commit ? v.commit.message : v.version ?? "Original"}
                  </button>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>{fmtNumber(v.chars)} characters</span>
                    <span className="ml-auto font-mono tabular-nums">{versionId(v)}</span>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Browse the text at this version" onClick={() => onChoose(v.document_id)}>
                            <FileTextIcon />
                          </Button>
                        }
                      />
                      <TooltipContent side="bottom">Browse the text at this version</TooltipContent>
                    </Tooltip>
                    {onOpenChanges && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="What this version changed" onClick={() => onOpenChanges(v.document_id)}>
                              <CodeIcon />
                            </Button>
                          }
                        />
                        <TooltipContent side="bottom">What this version changed</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
