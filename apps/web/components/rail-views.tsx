"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"

// A right rail with a second view (Brendan, 2026-09-19): the page's own —
// Favorites, its contents, Build with GovBlocks — and Settings, toggled at the
// top of the rail. The laws reader keeps its text settings here, as esv.org
// keeps them in a panel beside the text.

export function RailViews({ settings, children }: { settings: React.ReactNode; children: React.ReactNode }) {
  const [view, setView] = React.useState<"page" | "settings">("page")
  return (
    <>
      <div role="tablist" aria-label="Rail" className="mx-4 flex rounded-md bg-muted p-0.5 text-xs">
        {(["page", "settings"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn("flex-1 rounded-[5px] px-2 py-1 font-medium text-muted-foreground transition-colors", view === v && "bg-background text-foreground shadow-xs")}
          >
            {v === "page" ? "Page" : "Settings"}
          </button>
        ))}
      </div>
      {view === "page" ? children : settings}
    </>
  )
}
