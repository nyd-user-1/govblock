"use client"

import * as React from "react"
import { ChevronRightIcon } from "lucide-react"

import { Citations, type CitationItem } from "@/components/agents/citations"
import { cn } from "@govblock/ui/lib/utils"

// The trace report (Brendan, 2026-09-17), made real from the Clerk's
// open-primaries trace (public/reports/open-primaries-trace.html): a report
// that shows its work. Each step is a source paired with the Clerk — what the
// source returned, the Clerk's reading of it, and what came out — in the order
// the work was done, on the changelog's timeline: the rule down the left and a
// circle on it at every step, marked with the source. The last step is the
// Clerk alone, putting the steps together. The sources behind the steps sit in
// the briefs' Sources badge, which opens to the list.

export type Source = { title: string; url: string }

const domain = (url: string) => {
  try {
    return new URL(url, "https://gov.nysgpt.com").host.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** The briefs' sources control: a badge with the count that opens to the list. */
export function SourcesCited({ sources, className }: { sources: Source[]; className?: string }) {
  const items: CitationItem[] = sources.map((s, i) => ({ id: String(i + 1), title: s.title, url: s.url, domain: domain(s.url) }))
  return <Citations citations={items} title="Sources cited" className={cn("my-4", className)} />
}

export function Trace({ children }: { children: React.ReactNode }) {
  return <div className="mt-10 mb-12 ml-4 border-l pl-8 [&>section+section]:mt-16 [&_h3]:mt-0">{children}</div>
}

/** A fold under a step: what the source returned, or the Clerk's reading. */
function Fold({ label, tone, children }: { label: string; tone?: "reading"; children: React.ReactNode }) {
  return (
    <details className={cn("group/fold mt-3 rounded-xl border bg-muted/30 [&[open]]:bg-muted/40", tone === "reading" && "border-amber-500/30 bg-amber-500/5 [&[open]]:bg-amber-500/10")}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-3.5 transition-transform group-open/fold:rotate-90" />
        {label}
      </summary>
      <div className="px-3 pb-3 text-sm [&_p]:my-2 [&_table]:my-2">{children}</div>
    </details>
  )
}

/**
 * One step: the source's mark on the line, `source × the Clerk`, what was
 * done, the two folds, and the output. A chart or table in `children` sits
 * after the output. `synthesis` is the last step, the Clerk alone.
 */
export function TraceStep({
  id,
  mark,
  source,
  did,
  returned,
  reading,
  output,
  synthesis,
  children,
}: {
  id: string
  /** Two or three letters for the circle: DB, FEC, LDA, CG, WEB. */
  mark: string
  source: string
  did: React.ReactNode
  returned?: React.ReactNode
  reading?: React.ReactNode
  output: React.ReactNode
  synthesis?: boolean
  children?: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h3 className="relative">
        <span
          aria-hidden
          className={cn(
            "absolute mt-[-3px] ml-[-58px] inline-flex size-9 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold tracking-tight ring-1 ring-border",
            synthesis ? "bg-foreground text-background" : "bg-muted text-foreground"
          )}
        >
          {mark}
        </span>
        {synthesis ? "The Clerk" : `${source} × the Clerk`}
      </h3>
      <p className="text-muted-foreground">{did}</p>
      {returned && <Fold label={synthesis ? "What the steps established" : `What ${source} returned`}>{returned}</Fold>}
      {reading && (
        <Fold label="The Clerk's reading" tone="reading">
          {reading}
        </Fold>
      )}
      <div className="mt-4 rounded-xl border-l-4 border-foreground/70 bg-background py-1 pl-4">
        <p className="my-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Output</p>
        <div className="[&_p]:my-1">{output}</div>
      </div>
      {children}
    </section>
  )
}
