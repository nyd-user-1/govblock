"use client"

import * as React from "react"

import { useTocSideBar, useTocSideBarState } from "@platejs/toc/react"
import { cn } from "@govblock/ui/lib/utils"

// Potion's sticky outline (Brendan, 2026-09-10, from potion.platejs.org). It
// rides the right edge of the page as a column of rules, one per heading,
// indented by depth — the way a long document shows its shape without spending
// room on it. Point at it and the rules become the headings themselves; click
// one and the page goes there.
//
// A bill is the document this was made for: H.R. 5366 alone is twenty-seven
// headings deep in sections, subsections and lettered clauses.

const INDENT = ["mr-0", "mr-0", "mr-3", "mr-6", "mr-9", "mr-12", "mr-12"]
const WIDTH = ["w-8", "w-8", "w-6", "w-5", "w-4", "w-3.5", "w-3"]

export function PotionOutline({ className }: { className?: string }) {
  const state = useTocSideBarState({ open: true, topOffset: 80 })
  const { navProps, onContentClick } = useTocSideBar(state)
  const { activeContentId, headingList, mouseInToc } = state
  if (headingList.length < 2) return null
  return (
    <nav
      {...navProps}
      aria-label="Outline"
      className={cn(
        "group/toc absolute top-16 right-0 z-20 hidden max-h-[70vh] overflow-y-auto py-2 pr-3 lg:block",
        "transition-[width] duration-200",
        mouseInToc ? "w-64 pl-3" : "w-16",
        className
      )}
    >
      <ul className="flex flex-col gap-1">
        {headingList.map((heading) => {
          const depth = Math.min(heading.depth, INDENT.length - 1)
          const active = activeContentId === heading.id
          return (
            <li key={heading.id} className={INDENT[depth]}>
              <button
                type="button"
                onClick={(event) => onContentClick(event, heading, "smooth")}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-end rounded py-1 text-right",
                  mouseInToc ? "px-1" : "px-0"
                )}
              >
                {mouseInToc ? (
                  <span
                    className={cn(
                      "truncate text-xs leading-tight",
                      active
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {heading.title}
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "h-0.5 rounded-full",
                      WIDTH[depth],
                      active ? "bg-foreground" : "bg-muted-foreground/40"
                    )}
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
