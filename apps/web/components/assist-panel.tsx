"use client"

import * as React from "react"
import { MessageSquareIcon, XIcon } from "lucide-react"

import { useAssistPanel, type AssistSubject } from "@/lib/assist-panel"
import { stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { AssistChat } from "@/components/policy/assist-chat"
import { Button } from "@govblock/ui/components/nova/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/nova/tooltip"
import { cn } from "@govblock/ui/lib/utils"

// The drawer itself: fixed to the right edge, outside the routed page tree,
// so a navigation never unmounts it. Closed, it sits off screen; open, it
// slides in and the page narrows beside it (AssistShell), the way 44b's
// discussion drawer pushes content rather than sheeting over it.

export const ASSIST_WIDTH = "w-[423px]"

export function AssistPanel() {
  const { open, close, subject } = useAssistPanel()
  const { state } = useJurisdiction()
  const fallback = React.useMemo<AssistSubject>(
    () => ({
      chatId: `workspace-${state}`,
      system: `You are Livingston, a legislative assistant for the ${stateName(state)} legislature. Answer plainly, cite what you know, and say when you don't.`,
      placeholder: `Ask about ${stateName(state)}…`,
      title: stateName(state),
    }),
    [state]
  )
  const chat = subject ?? fallback
  return (
    // The same frame as the main container, at the same height (Brendan,
    // 2026-09-07): the stage's outer ring and its inset card, standing in the
    // gap the designer keeps around its stage, from under the site header to
    // the bottom gap.
    <aside
      data-slot="assist-panel"
      aria-hidden={!open}
      className={cn(
        "fixed right-(--gap) bottom-(--gap) z-40 flex max-w-[calc(100vw-2*var(--gap))] flex-col transition-transform duration-300 ease-in-out [--gap:--spacing(4)] md:[--gap:--spacing(6)]",
        ASSIST_WIDTH,
        open ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+var(--gap))]"
      )}
      style={{ top: "calc(var(--header-height) + var(--gap) * 0.25)" }}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
        <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
        <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-sidebar" style={{ "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}>
          <div className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-sm">
            <header className="relative z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b">
              <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <MessageSquareIcon className="size-4 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 items-center gap-2 text-base font-medium">{chat.title ?? "Chat"}</div>
                <Button variant="ghost" size="icon-sm" className="-mr-1" aria-label="Close the chat" onClick={close}>
                  <XIcon />
                </Button>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <AssistChat chatId={chat.chatId} system={chat.system} agentSlug={chat.agentSlug} placeholder={chat.placeholder} compact className="min-h-0 flex-1" />
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

/** Wraps the routed pages and narrows them while the drawer is open. */
export function AssistShell({ children }: { children: React.ReactNode }) {
  const { open } = useAssistPanel()
  // The drawer stands a gap in from the edge, so the pages give up its width plus that gap.
  return <div className={cn("flex min-h-0 flex-1 flex-col transition-[padding] duration-300 ease-in-out [--gap:--spacing(4)] md:[--gap:--spacing(6)]", open && "md:pr-[calc(423px+var(--gap))]")}>{children}</div>
}

/** The button that summons the drawer, wherever a footer wants one. */
export function AssistToggle({ className }: { className?: string }) {
  const { open, toggle } = useAssistPanel()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon" className={cn("size-7 cursor-pointer", className)} aria-label={open ? "Hide the chat" : "Show the chat"} aria-pressed={open} onClick={toggle}>
            <MessageSquareIcon className="size-4" />
          </Button>
        }
      />
      <TooltipContent side="top" sideOffset={10}>
        Chat
      </TooltipContent>
    </Tooltip>
  )
}
