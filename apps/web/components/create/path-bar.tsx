"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { type Target } from "@/lib/create/path"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

// The path to where you are, drawn the way GitHub draws one over a file
// listing: `Alabama / 2026 1st Special / Bills /`, each earlier segment a
// link, the last one plain, and a copy-link button on the end. Brendan,
// 2026-09-03: it is the block's header, not a row above the table — the
// header is the one thing that never scrolls away, so it wears the shadow the
// rows pass under and carries the Top button while they do.
//
// A folder's path ends in `/`, a file's does not, as on GitHub. A file's name
// is long — a bill's number and title — so the crumbs between the state and
// the file fold to `…`, each still the link it was (Brendan, 2026-09-03:
// `Alaska / … / … / SB9 — Surrender Of Infants`).

export type Crumb = { label: string; go?: Target }

export function PathBar({ crumbs, folder, onGo, className }: { crumbs: Crumb[]; folder: boolean; onGo: (go: Target) => void; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className={cn("flex min-w-0 items-center gap-1 text-sm font-normal", className)}>
      {crumbs.map((c, index) => {
        const last = index === crumbs.length - 1
        const folded = !folder && index > 0 && !last
        return (
          <React.Fragment key={`${c.label}-${index}`}>
            {index > 0 && <span className="shrink-0 text-muted-foreground">/</span>}
            {last || !c.go ? (
              <span className={cn("truncate font-medium", index === 0 && !last && "text-primary")}>{c.label}</span>
            ) : (
              <button type="button" onClick={() => onGo(c.go!)} title={folded ? c.label : undefined} className="shrink-0 text-primary hover:underline">
                {folded ? "…" : c.label}
              </button>
            )}
          </React.Fragment>
        )
      })}
      {folder && <span className="shrink-0 text-muted-foreground">/</span>}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Copy the link"
        className="ml-1 shrink-0"
        onClick={() => {
          void navigator.clipboard?.writeText(window.location.href)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}
