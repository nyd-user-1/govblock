"use client"

import { DownloadIcon, FileTextIcon } from "lucide-react"

import type { Attached } from "@/lib/agents/inbox"
import { cn } from "@/lib/utils"

// The file that rides at the bottom of a report — the PDF the Clerk delivered,
// as a card you can open, in the shape shadcn's Attachment uses (Brendan,
// 2026-09-08). A report's rich version is the PDF; the message body is the
// same report as text, so the card is how you get the paper one.

const CARD = "group flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50"

function Face({ name, meta }: { name: string; meta?: string }) {
  return (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <FileTextIcon className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{name}</span>
        {meta ? <span className="truncate text-xs text-muted-foreground">{meta}</span> : null}
      </span>
      <DownloadIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </>
  )
}

/** `onBuild` is what a card with no href does instead of opening one. */
export function AttachmentCard({ name, meta, href, build, onBuild }: Attached & { onBuild?: () => void }) {
  if (build)
    return (
      <button type="button" className={CARD} onClick={onBuild}>
        <Face name={name} meta={meta} />
      </button>
    )
  return (
    <a href={href} target="_blank" rel="noreferrer" className={CARD}>
      <Face name={name} meta={meta} />
    </a>
  )
}

export function AttachmentGroup({ items, className, onBuild }: { items: Attached[]; className?: string; onBuild?: (item: Attached) => void }) {
  if (!items.length) return null
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {items.map((a) => (
        <AttachmentCard key={a.href || a.name} {...a} onBuild={onBuild ? () => onBuild(a) : undefined} />
      ))}
    </div>
  )
}
