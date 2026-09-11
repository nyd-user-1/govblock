"use client"

import * as React from "react"
import { Maximize2Icon, Minimize2Icon } from "lucide-react"

import { SiteRail } from "@/components/home/home-rail"
import { BlockShell } from "@/components/policy/block-shell"
import { Button } from "@govblock/ui/components/ny4/button"
import { SidebarContent } from "@govblock/ui/components/ny4/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/nova/tooltip"
import { cn } from "@govblock/ui/lib/utils"

// /chat in the shell every workspace item wears (Brendan, 2026-09-11): the
// stage in its rounded frame, the block shell's header and rail across it,
// the rail the site rail. It opens closed, as the workspace's pages do.
//
// The conversation column is hq's (~/Code/hq, app/ui/terminal.tsx): "focus
// mode", a centered column `max-w-3xl px-4` — 736px of chat — is the
// default, and the toggle at the top right of the pane flips it to wide
// screen and back: maximize-2 while focused, minimize-2 while wide. This
// browser remembers the choice.

const FOCUS_KEY = "govblock:chat:focus"

export function ChatShell({ children }: { children: React.ReactNode }) {
  const [focus, setFocus] = React.useState(true)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(FOCUS_KEY)
      if (saved === "0") setFocus(false)
    } catch {}
  }, [])
  const toggle = () =>
    setFocus((f) => {
      const next = !f
      try {
        localStorage.setItem(FOCUS_KEY, next ? "1" : "0")
      } catch {}
      return next
    })
  const label = focus ? "Wide screen" : "Focus mode"
  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--gap:--spacing(4)] md:[--gap:--spacing(6)]">
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)]">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <BlockShell
              defaultOpen={false}
              rail={
                <SidebarContent className="scrollbar-none overflow-x-hidden">
                  <SiteRail />
                </SidebarContent>
              }
              title="Chat"
              actions={
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label={label} onClick={toggle}>
                        {focus ? <Maximize2Icon className="size-3.5" /> : <Minimize2Icon className="size-3.5" />}
                      </Button>
                    }
                  />
                  <TooltipContent side="bottom" sideOffset={6}>
                    {label}
                  </TooltipContent>
                </Tooltip>
              }
              contentClassName="overflow-hidden"
            >
              {/* Centered column when focused; `display: contents`, a no-op, when wide. */}
              <div className={cn(focus ? "mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4" : "contents")}>{children}</div>
            </BlockShell>
          </div>
        </div>
      </div>
    </div>
  )
}
