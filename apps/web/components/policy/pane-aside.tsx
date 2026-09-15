"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"

// The aside a file view opens beside its text (Brendan, 2026-09-13): the
// outline, the references and the search results in the Git view's text
// pane, and the bill's actions beside the Typeset editor. One shell —
// 320 wide, a hairline on its left, a 36px title row with the close at its
// right, the list scrolling under it — so a panel opened on one view is the
// panel opened on every view.
export function PaneAside({ title, onClose, children, className, bodyClassName }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; /** Replaces the 320 width, for a pane that shows a whole text. */ className?: string; bodyClassName?: string }) {
  return (
    <aside className={cn("flex w-80 shrink-0 flex-col border-l", className)}>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs font-medium">
        {title}
        <button type="button" aria-label="Close" className="ml-auto text-muted-foreground hover:text-foreground" onClick={onClose}>
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto py-1", bodyClassName)}>{children}</div>
    </aside>
  )
}
