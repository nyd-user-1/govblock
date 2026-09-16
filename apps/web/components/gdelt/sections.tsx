"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@govblock/ui/components/ny4/collapsible"
import { cn } from "@govblock/ui/lib/utils"

// Every panel on /gdelt is a question (Brendan, 2026-09-16): the heading asks
// it, the answer is folded behind the chevron at the end of that same line, and
// the footnote says how the figure was arrived at and what it was read from. A
// reader who only scans headings still learns what the page can tell them.

export function Question({
  id,
  question,
  answer,
  method,
  children,
}: {
  id: string
  question: string
  /** Folded away until the chevron is pressed. */
  answer: React.ReactNode
  /** How it was measured, and what it was read from. */
  method: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="not-typeset flex scroll-mt-24 flex-col gap-4" id={id}>
      <Collapsible>
        <div className="flex items-baseline gap-3">
          <h2 className="font-heading min-w-0 text-lg font-semibold tracking-tight sm:text-xl">{question}</h2>
          <CollapsibleTrigger
            aria-label="What this shows"
            className="group/answer ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]/answer:rotate-180" />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="mt-3 border-l-2 pl-4 text-sm text-muted-foreground *:[strong]:font-semibold *:[strong]:text-foreground">{answer}</div>
        </CollapsibleContent>
      </Collapsible>
      {children}
      <p className="text-xs text-muted-foreground">{method}</p>
    </section>
  )
}

/** A block's first rows, with the rest behind a button — the See more the record pages use. */
export function ShowMore({
  initial,
  children,
  className,
  noun = "more",
}: {
  initial: number
  children: React.ReactNode
  className?: string
  noun?: string
}) {
  const [all, setAll] = React.useState(false)
  const rows = React.Children.toArray(children)
  const shown = all ? rows : rows.slice(0, initial)
  const hidden = rows.length - shown.length
  return (
    <>
      <div className={className}>{shown}</div>
      {hidden > 0 || all ? (
        <div className="flex">
          <Button variant="outline" size="sm" onClick={() => setAll((open) => !open)}>
            {all ? "See fewer" : `See ${hidden} ${noun}`}
          </Button>
        </div>
      ) : null}
    </>
  )
}

/** The count a panel reports, in the footnote's place above the method line. */
export const Count = ({ children }: { children: React.ReactNode }) => <p className={cn("text-xs text-muted-foreground tabular-nums")}>{children}</p>
