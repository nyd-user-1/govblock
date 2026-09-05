"use client"

import * as React from "react"

// The strip at the top of every shadcn component page — Base UI · React Aria
// · Radix UI, the open one underlined, a glyph at the far right — class for
// class, as buttons that switch what sits beneath. The subjects page splits
// its legislative subject terms with it (Brendan, 2026-09-05).

export function LibraryTabs<T extends string>({
  tabs,
  value,
  onChange,
  right,
}: {
  tabs: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /** What sits at the strip's right end, where shadcn puts the library's mark. */
  right?: React.ReactNode
}) {
  return (
    <div className="not-typeset mb-4 inline-flex w-full items-center gap-6">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          data-active={tab.value === value}
          onClick={() => onChange(tab.value)}
          className="relative inline-flex items-center justify-center gap-1 pt-1 pb-0.5 text-base font-medium text-muted-foreground transition-colors after:absolute after:inset-x-0 after:bottom-[-4px] after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity hover:text-foreground data-[active=true]:text-foreground data-[active=true]:after:opacity-100"
        >
          {tab.label}
        </button>
      ))}
      {right && <div className="ml-auto size-4 shrink-0 text-muted-foreground opacity-80 [&_svg]:size-4">{right}</div>}
    </div>
  )
}
