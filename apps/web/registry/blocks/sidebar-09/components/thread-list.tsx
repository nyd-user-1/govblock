"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, PanelRightIcon, RefreshCwIcon, RowsIcon, StarIcon } from "lucide-react"

import { inFolder, isUnread, matches, running, shownRecipients, teaser, when, type Folder, type Thread } from "@/lib/agents/inbox"
import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

// The thread list in Gmail's shape (Brendan, 2026-09-07, from his screenshot):
// a toolbar — the select-all box with its menu, refresh, more; at the right
// the count, the pager and the split toggle — then the threads as rows. Full
// width, a row is one line: box, star, the marker, who, the subject in bold
// with the teaser after a dash, the time. In split mode the same row stacks
// three lines high, who and the time, the subject, the teaser with the star,
// the way Gmail folds it beside a reading pane. Unread is bold on a lit ground.

export type ListTab = "all" | "unread"
export type Split = "none" | "vertical"

const TITLES: Record<Folder, string> = { inbox: "Inbox", sent: "Sent", drafts: "Drafts", starred: "Starred", trash: "Trash" }

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Gmail's importance marker: lit for a task still running or one that failed, quiet otherwise. */
function Marker({ thread }: { thread: Thread }) {
  const lit = thread.status === "running" || thread.status === "failed"
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={cn("size-4 shrink-0", lit ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/50")}>
      <path d="M4 5h7l5 5-5 5H4l5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

export function ThreadList({
  threads,
  folder,
  selected,
  tab,
  onTab,
  onOpenThread,
  onStar,
  onRefresh,
  onMarkAllRead,
  onClear,
  split,
  onSplit,
}: {
  threads: Thread[]
  folder: Folder
  selected: string | null
  tab: ListTab
  onTab: (tab: ListTab) => void
  onOpenThread: (id: string) => void
  onStar: (id: string) => void
  onRefresh: () => void
  onMarkAllRead: () => void
  onClear: () => void
  split: Split
  onSplit: (split: Split) => void
}) {
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set())
  const shown = threads
    .filter((thread) => inFolder(thread, folder))
    .filter((thread) => matches(thread, ""))
    .filter((thread) => tab === "all" || isUnread(thread))
  const allChecked = shown.length > 0 && shown.every((thread) => checked.has(thread.id))
  const someChecked = shown.some((thread) => checked.has(thread.id))
  const toggleAll = (on: boolean) => setChecked(on ? new Set(shown.map((thread) => thread.id)) : new Set())
  const toggle = (id: string, on: boolean) =>
    setChecked((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const stacked = split === "vertical"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b px-3">
        <div className="flex items-center">
          <Checkbox aria-label="Select all" checked={allChecked} indeterminate={!allChecked && someChecked} onCheckedChange={(value) => toggleAll(value === true)} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Select" className="-ml-0.5 size-6">
                <ChevronDownIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-max min-w-40">
              <DropdownMenuItem onClick={() => toggleAll(true)}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleAll(false)}>None</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChecked(new Set(shown.filter(isUnread).map((t) => t.id)))}>Unread</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChecked(new Set(shown.filter((t) => t.starred).map((t) => t.id)))}>Starred</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Tip label="Refresh">
          <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={onRefresh}>
            <RefreshCwIcon className="size-4" />
          </Button>
        </Tip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More">
              <EllipsisVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-max min-w-48">
            <DropdownMenuRadioGroup value={tab} onValueChange={(value) => onTab(value as ListTab)}>
              <DropdownMenuRadioItem value="all">All {TITLES[folder].toLowerCase()}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="unread">Unread only</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onMarkAllRead}>Mark all as read</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onClear}>
              Clear every thread
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-1">
          <span className="px-2 text-xs text-muted-foreground tabular-nums">{shown.length ? `1–${shown.length} of ${shown.length}` : "0 of 0"}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Newer" disabled>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Older" disabled>
            <ChevronRightIcon className="size-4" />
          </Button>
          {/* The split toggle (Brendan, 2026-09-07): the list alone, or the list beside a reading pane. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Toggle split pane" className="gap-0.5 px-1.5">
                {stacked ? <PanelRightIcon className="size-4" /> : <RowsIcon className="size-4" />}
                <ChevronDownIcon className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-max min-w-44">
              <DropdownMenuRadioGroup value={split} onValueChange={(value) => onSplit(value as Split)}>
                <DropdownMenuRadioItem value="none">No split</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="vertical">Vertical split</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {shown.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">{tab === "unread" ? "Nothing unread." : folder === "inbox" ? "Nothing has arrived yet. Compose a task and the reply lands here." : "Nothing here."}</p>
        )}
        <ul className="divide-y">
          {shown.map((thread) => {
            // Unread is the arriving reply, never your own message — a thread
            // you composed is born read on your side.
            const unread = isUnread(thread)
            const active = selected === thread.id
            const who = folder === "sent" || folder === "drafts" ? `To: ${shownRecipients(thread).join(", ")}` : shownRecipients(thread).join(", ") || thread.agentName
            const snippet = thread.status === "running" ? running(thread) : teaser(thread)
            const star = (
              <button
                type="button"
                aria-label={thread.starred ? "Remove star" : "Star"}
                aria-pressed={!!thread.starred}
                onClick={(event) => {
                  event.stopPropagation()
                  onStar(thread.id)
                }}
                className="shrink-0 rounded-sm text-muted-foreground/60 hover:text-foreground"
              >
                <StarIcon className={cn("size-4", thread.starred && "fill-yellow-400 text-yellow-500")} />
              </button>
            )
            return (
              <li
                key={thread.id}
                data-active={active}
                data-unread={unread}
                className={cn("group/row flex cursor-pointer items-start gap-3 px-3 text-sm transition-colors hover:bg-accent/60", stacked ? "py-2.5" : "h-10 items-center", unread && "bg-primary/5", active && "bg-muted")}
                onClick={() => onOpenThread(thread.id)}
              >
                <span className={cn("flex shrink-0 items-center gap-2", stacked && "pt-0.5")} onClick={(event) => event.stopPropagation()}>
                  <Checkbox aria-label={`Select ${thread.subject}`} checked={checked.has(thread.id)} onCheckedChange={(value) => toggle(thread.id, value === true)} />
                  {!stacked && star}
                  <Marker thread={thread} />
                </span>
                {stacked ? (
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{who}</span>
                      <span className={cn("ml-auto shrink-0 text-xs tabular-nums", unread ? "font-semibold" : "text-muted-foreground")}>{when(thread.updatedAt)}</span>
                    </span>
                    <span className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{thread.subject}</span>
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-muted-foreground", thread.status === "running" && "animate-pulse")}>{snippet}</span>
                      <span className="ml-auto">{star}</span>
                    </span>
                  </span>
                ) : (
                  <>
                    <span className={cn("w-44 shrink-0 truncate", unread ? "font-semibold" : "font-medium")}>{who}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className={cn(unread ? "font-semibold" : "font-medium")}>{thread.subject}</span>
                      {snippet && <span className={cn("text-muted-foreground", thread.status === "running" && "animate-pulse")}> - {snippet}</span>}
                    </span>
                    <span className={cn("shrink-0 text-xs tabular-nums", unread ? "font-semibold" : "text-muted-foreground")}>{when(thread.updatedAt)}</span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
