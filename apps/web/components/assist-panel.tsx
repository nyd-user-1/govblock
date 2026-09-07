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
    <aside
      data-slot="assist-panel"
      aria-hidden={!open}
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex max-w-full flex-col p-[18px] pl-0 transition-transform duration-300 ease-in-out",
        ASSIST_WIDTH,
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-background shadow-[0_4px_32px_rgba(0,0,0,0.10)]">
        <div className="flex shrink-0 items-center gap-2 border-b px-5 py-3">
          <MessageSquareIcon className="size-4 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{chat.title ?? "Chat"}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Close the chat" onClick={close}>
            <XIcon />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <AssistChat chatId={chat.chatId} system={chat.system} agentSlug={chat.agentSlug} placeholder={chat.placeholder} compact className="min-h-0 flex-1" />
        </div>
      </div>
    </aside>
  )
}

/** Wraps the routed pages and narrows them while the drawer is open. */
export function AssistShell({ children }: { children: React.ReactNode }) {
  const { open } = useAssistPanel()
  return <div className={cn("flex min-h-0 flex-1 flex-col transition-[padding] duration-300 ease-in-out", open && "md:pr-[423px]")}>{children}</div>
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
