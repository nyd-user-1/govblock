import * as React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { truncate } from "@/lib/format"
import { hasSeal } from "@/lib/imagery"
import { ChamberSeal } from "@/components/policy/imagery"
import { cn } from "@govblock/ui/lib/utils"

// The item canon. Every record list on the site draws the same item, so it is
// drawn in exactly one file.
//
// It is the Record list from the member page — the seal, the bold number, the
// latest action beside it, the meta line, the title beneath, the grey hover and
// the arrow in the corner — with the three revisions Brendan gave on
// 2026-09-02: the meta line is text-xs, the description sits 8 px under it, and
// every item carries a 1 px bottom border.
//
// What varies between lists is data, not shape: which avatar, what goes in the
// bold slot, and which facts the meta line has to say. A list that is not the
// member's own page appends the sponsor; a committee's own page drops the
// committee, because the page is already that committee.
//
// No "use client" on purpose: server pages (member, committee) and client
// lists (bills, the federal families) both render it.

export function RecordList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("not-typeset mt-6 mb-8 flex flex-col", className)}>{children}</div>
}

export function RecordItem({
  href,
  external,
  avatar,
  title,
  lead,
  meta,
  description,
  className,
}: {
  href: string
  /** congress.gov and crsreports are other people's pages; they open away. */
  external?: boolean
  /** Omitted where the family has no emblem — a topic, a page of this site. */
  avatar?: React.ReactNode
  /** The bold slot: a bill number, a citation, a public-law number. */
  title: React.ReactNode
  /** Row 1's muted tail — the latest action, one line, truncated. */
  lead?: string | null
  /** Row 2, joined with " · " in the order given. Falsy entries drop out. */
  meta?: (string | null | undefined | false)[]
  /** Row 3 — the title of the thing, in body text. */
  description?: React.ReactNode
  className?: string
}) {
  const line = (meta ?? []).filter(Boolean).join(" · ")
  const body = (
    <>
      {avatar && <span className="shrink-0 pt-0.5">{avatar}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-2 pr-6 text-base font-semibold text-foreground">
          {/* The bold slot never wraps: a citation is one token and `PN730-2`
              broken across two lines reads as two different nominations. */}
          <span className="shrink-0 whitespace-nowrap">{title}</span>
          {lead && <span className="min-w-0 truncate font-normal text-muted-foreground">{truncate(lead, 90)}</span>}
        </span>
        {line && <span className="mt-1 text-xs text-muted-foreground">{line}</span>}
        {description && <span className="mt-2 text-sm text-foreground">{description}</span>}
      </span>
      {/* The whole item has always been the link; this is what says so. */}
      <ArrowUpRight
        aria-hidden
        className="absolute top-3 right-3 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
      />
    </>
  )
  const classes = cn(
    "group relative flex gap-4 rounded-lg border-b px-3 py-4 no-underline transition-colors hover:bg-muted/50 md:px-4",
    className
  )
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {body}
      </a>
    )
  }
  return (
    <Link href={href} className={classes}>
      {body}
    </Link>
  )
}

/**
 * The chamber's seal in a circle, with the ruled fallback the member page has
 * always used: a jurisdiction with no seal on file keeps its ordinal, which is
 * the numbered circle this list was before it wore seals.
 */
export function RecordSeal({
  state,
  chamber,
  ordinal,
  size = 36,
}: {
  state: string
  chamber?: string | null
  /** 1-based position, drawn only when the jurisdiction has no seal. */
  ordinal?: number
  size?: number
}) {
  if (hasSeal(state, chamber)) {
    return <ChamberSeal state={state} chamber={chamber} size={size} />
  }
  return (
    <span
      className="flex items-center justify-center rounded-full bg-muted text-center font-mono text-sm font-medium text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {ordinal ?? ""}
    </span>
  )
}

/**
 * An image avatar that is not a chamber seal: a nominating department's seal,
 * or the research service's logo. `shape="rect"` is for a wordmark that will
 * not survive a circle — the CRS logo is a horizontal lockup, and cropping it
 * round would cut the words off.
 */
export function RecordAvatar({
  src,
  alt = "",
  size = 36,
  shape = "circle",
}: {
  src: string
  alt?: string
  size?: number
  shape?: "circle" | "rect"
}) {
  const rect = shape === "rect"
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-muted ring-1 ring-border/60 select-none",
        rect ? "rounded-md" : "rounded-full"
      )}
      style={{ width: rect ? Math.round(size * 1.75) : size, height: size }}
    >
      {/* Plain <img>: these are committed files of thirty-odd shapes, and the
          only thing that matters is that none of them is cropped. */}
      <img src={src} alt={alt} aria-hidden={alt ? undefined : true} loading="lazy" decoding="async" className="m-0 size-full object-contain p-1" />
    </span>
  )
}
