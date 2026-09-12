"use client"

import * as React from "react"
import { FileText } from "lucide-react"

import { CopyButton } from "@/components/copy-button"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/ny4/button"

// A long source, folded (rebuilt 2026-09-12): the same frame as every code
// figure, one Expand in the caption, and a fade over the fold — no second
// button floating in the middle of the code.
export function CodeCollapsibleWrapper({ title, code, className, children }: { title?: string; code: string; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <figure data-rehype-pretty-code-figure="" data-titled="" data-state={open ? "open" : "closed"} className={cn("not-typeset group/fold relative mt-6 mb-6 overflow-hidden rounded-xl border border-border/50 bg-surface text-surface-foreground", className)}>
      <figcaption data-rehype-pretty-code-title="" className="flex h-9 items-center gap-2 border-b border-border/50 px-3 font-mono text-[13px] text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:opacity-70">
        <FileText />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <Button variant="ghost" size="sm" className="h-7 rounded-md px-2 text-xs text-muted-foreground" onClick={() => setOpen((o) => !o)}>
          {open ? "Collapse" : "Expand"}
        </Button>
        <span aria-hidden className="mx-0.5 h-4 w-px bg-border/60" />
        <CopyButton value={code} className="static! size-7" />
      </figcaption>
      <div data-not-typeset="" className={cn("relative", !open && "max-h-72 overflow-hidden")}>
        {children}
        {!open && <button type="button" aria-label="Expand" onClick={() => setOpen(true)} className="absolute inset-x-0 bottom-0 h-20 cursor-pointer bg-gradient-to-b from-transparent to-surface" />}
      </div>
    </figure>
  )
}
