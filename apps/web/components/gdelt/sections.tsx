"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@govblock/ui/components/ny4/collapsible"
import { cn } from "@govblock/ui/lib/utils"

// Every panel on /gdelt is a question (Brendan, 2026-09-16): the heading asks
// it, the answer is folded away until someone wants it, and the footnote says
// how the number was arrived at and what it was read from. A reader who only
// scans headings still learns what the page can tell them.

export function Question({
  n,
  question,
  answer,
  method,
  aside,
  children,
}: {
  n: number
  question: string
  /** Folded away by default. */
  answer: React.ReactNode
  /** How it was measured, and what it was read from. */
  method: React.ReactNode
  aside?: string
  children: React.ReactNode
}) {
  return (
    <section className="not-typeset flex scroll-mt-24 flex-col gap-4" id={`q${n}`}>
      <Collapsible>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm text-muted-foreground tabular-nums">{n}</span>
            <h2 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">{question}</h2>
            {aside ? <span className="ml-auto shrink-0 text-sm text-muted-foreground tabular-nums">{aside}</span> : null}
          </div>
          <CollapsibleTrigger className="group/answer flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Answer
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

/** Two panels side by side, the taller one's overflow folded away so they end level. */
export function Pair({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid gap-4 lg:grid-cols-2", className)}>{children}</div>
}
