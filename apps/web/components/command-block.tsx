"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

// shadcn's command block — the terminal glyph, the package-manager tabs, the
// copy button and the mono command beneath — as one component. The member
// page's Office block was the first to wear it (Brendan, 2026-09-05), with
// the House seal in the glyph's place; the subjects page's command line is
// the second, with the glyph itself.

export type CommandTab = { value: string; label: string; lines: string[] }

/** shadcn's terminal glyph, the tabler icon in a dark square. */
export function TerminalGlyph() {
  return (
    <div className="flex size-4 items-center justify-center rounded-[1px] bg-foreground opacity-70">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3 text-code">
        <path d="M5 7l5 5l-5 5"></path>
        <path d="M12 19l7 0"></path>
      </svg>
    </div>
  )
}

export function CommandBlock({ tabs, icon }: { tabs: CommandTab[]; icon?: React.ReactNode }) {
  const [active, setActive] = React.useState(0)
  const [copied, setCopied] = React.useState(false)
  const tab = tabs[Math.min(active, tabs.length - 1)]
  if (!tab) return null

  async function copy() {
    await navigator.clipboard.writeText(tab.lines.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="not-typeset relative mt-6 mb-12 overflow-hidden rounded-xl border border-border/50 bg-surface text-surface-foreground">
      <div data-slot="tabs" className="group/tabs flex gap-0 data-[orientation=horizontal]:flex-col" data-orientation="horizontal">
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1">
          {icon ?? <TerminalGlyph />}
          <div
            data-slot="tabs-list"
            className="group/tabs-list inline-flex h-9 w-fit items-center justify-center rounded-none bg-transparent p-0 text-muted-foreground"
          >
            {tabs.map((t, i) => (
              <button
                key={t.value}
                type="button"
                data-slot="tabs-trigger"
                data-state={i === active ? "active" : "inactive"}
                onClick={() => setActive(i)}
                className="relative inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 pt-0.5 font-mono text-sm font-medium whitespace-nowrap text-foreground/60 shadow-none! transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring data-[state=active]:border-input data-[state=active]:bg-background! data-[state=active]:text-foreground dark:text-muted-foreground dark:hover:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="no-scrollbar overflow-x-auto">
          <div data-slot="tabs-content" className="mt-0 flex-1 px-4 py-3.5 outline-none">
            <pre className="m-0 bg-transparent p-0">
              <code className="relative font-mono text-sm leading-relaxed">{tab.lines.join("\n")}</code>
            </pre>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy"}
        className="absolute top-2 right-2 z-10 inline-flex size-7 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap opacity-70 transition-all outline-none hover:bg-accent hover:text-accent-foreground hover:opacity-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:opacity-100 dark:hover:bg-accent/50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  )
}
