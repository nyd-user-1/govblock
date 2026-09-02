"use client"

import * as React from "react"
import { Search, Star } from "lucide-react"

import {
  inFolder,
  isUnread,
  matches,
  running,
  shownRecipients,
  teaser,
  threadCost,
  when,
  type Folder,
  type Thread,
} from "@/lib/agents/inbox"
import { cn } from "@/lib/utils"
import { Badge } from "@govblock/ui/components/ny4/badge"
import { Input } from "@govblock/ui/components/ny4/input"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@govblock/ui/components/ny4/tabs"

// The thread list, in the shape of shadcn's mail example: a title with the
// All mail / Unread switch beside it, a search field, and the threads as cards
// that scroll inside the pane. A thread is a task — the message you sent and
// the agent's reply — so the card carries what a task has and mail does not:
// its status, and what it cost.

export type ListTab = "all" | "unread"

const TITLES: Record<Folder, string> = {
  inbox: "Inbox",
  sent: "Sent",
  drafts: "Drafts",
  starred: "Starred",
  trash: "Trash",
}

function StatusBadge({ thread }: { thread: Thread }) {
  switch (thread.status) {
    case "running":
      return <Badge>Running</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
    case "draft":
      return <Badge variant="outline">Draft</Badge>
    default:
      return <Badge variant="secondary">Delivered</Badge>
  }
}

export function ThreadList({
  threads,
  folder,
  selected,
  tab,
  onTab,
  onOpenThread,
}: {
  threads: Thread[]
  folder: Folder
  selected: string | null
  tab: ListTab
  onTab: (tab: ListTab) => void
  onOpenThread: (id: string) => void
}) {
  const [query, setQuery] = React.useState("")

  // Search reaches across every folder, the way mail search does — a thread you
  // sent and a report you were sent are the same thread, and looking for one
  // should not depend on remembering which side of it you are on.
  const searching = query.trim().length > 0
  const shown = threads
    .filter((thread) => (searching ? !thread.trashed || folder === "trash" : inFolder(thread, folder)))
    .filter((thread) => matches(thread, query))
    .filter((thread) => tab === "all" || isUnread(thread))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-2 border-b px-4">
        <h2 className="truncate text-xl font-bold">{searching ? "All mail" : TITLES[folder]}</h2>
        <Tabs value={tab} onValueChange={(value) => onTab(value as ListTab)}>
          <TabsList>
            <TabsTrigger value="all">All mail</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="shrink-0 p-4">
        <form onSubmit={(event) => event.preventDefault()}>
          <div className="relative">
            <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-8"
            />
          </div>
        </form>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-4 pt-0">
          {shown.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {searching
                ? `Nothing matches “${query.trim()}”.`
                : tab === "unread"
                  ? "Nothing unread."
                  : folder === "inbox"
                    ? "Nothing has arrived yet. Compose a task and the reply lands here."
                    : "Nothing here."}
            </p>
          )}
          {shown.map((thread) => {
            // Unread is the arriving reply, never your own message — a thread
            // you composed is born read on your side.
            const unread = isUnread(thread)
            const active = selected === thread.id
            const cost = threadCost(thread)
            const who =
              folder === "sent" || folder === "drafts"
                ? `To: ${shownRecipients(thread).join(", ")}`
                : shownRecipients(thread).join(", ") || thread.agentName
            return (
              <button
                type="button"
                key={thread.id}
                onClick={() => onOpenThread(thread.id)}
                data-active={active}
                data-unread={unread}
                className={cn(
                  "flex w-full flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
                  active && "bg-muted"
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <span className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{who}</span>
                  {unread && <span aria-label="Unread" className="size-2 shrink-0 rounded-full bg-blue-600" />}
                  {thread.starred && <Star className="size-3 shrink-0 fill-yellow-400 text-yellow-500" />}
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-xs",
                      active ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {when(thread.updatedAt)}
                  </span>
                </div>
                <div className="line-clamp-1 w-full text-xs font-medium">{thread.subject}</div>
                <div className="line-clamp-2 w-full text-xs text-muted-foreground">
                  {thread.status === "running" ? (
                    <span className="inline-flex items-center gap-1.5">
                      {/* A running task must never be mistaken for a finished
                          one. The dot pulses beside whatever tool is in flight. */}
                      <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
                      <span className="animate-pulse">{running(thread)}</span>
                    </span>
                  ) : (
                    teaser(thread)
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge thread={thread} />
                  {cost > 0 && <Badge variant="outline">${cost.toFixed(2)}</Badge>}
                  {thread.deliveredTo && <Badge variant="outline">{thread.deliveredTo}</Badge>}
                </div>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
