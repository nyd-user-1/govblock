"use client"

import * as React from "react"
import { Command, File, Inbox, PenSquare, Send, Star, Trash2 } from "lucide-react"

import {
  inFolder,
  isUnread,
  matches,
  running,
  teaser,
  unreadIn,
  when,
  type Folder,
  type Thread,
} from "@/lib/agents/inbox"
import { cn } from "@/lib/utils"
import { NavUser } from "@/registry/blocks/sidebar-09/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@govblock/ui/components/ny4/sidebar"

// The Agentic Inbox. This is shadcn's sidebar-09 mail block with its markup and
// classNames intact and its contents replaced: the icon rail is the folders, the
// second sidebar is the thread list, and a thread is a task — the message you
// sent and the agent's reply to it. Repurposed by content; nothing redesigned.

const FOLDERS: { title: string; icon: typeof Inbox; folder: Folder }[] = [
  { title: "Inbox", icon: Inbox, folder: "inbox" },
  { title: "Sent", icon: Send, folder: "sent" },
  { title: "Drafts", icon: File, folder: "drafts" },
  { title: "Starred", icon: Star, folder: "starred" },
  { title: "Trash", icon: Trash2, folder: "trash" },
]

export function AppSidebar({
  threads,
  selected,
  folder,
  onFolder,
  // Not `onSelect`: Sidebar spreads a div's props, whose own onSelect would
  // intersect with this one and hand the callback a SyntheticEvent.
  onOpenThread,
  onCompose,
  onClear,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  threads: Thread[]
  selected: string | null
  folder: Folder
  onFolder: (folder: Folder) => void
  onOpenThread: (id: string) => void
  onCompose: () => void
  onClear: () => void
}) {
  const [query, setQuery] = React.useState("")
  const { setOpen } = useSidebar()

  const active = FOLDERS.find((entry) => entry.folder === folder) ?? FOLDERS[0]!

  // Search reaches across every folder, the way mail search does — a thread you
  // sent and a report you were sent are the same thread, and looking for one
  // should not depend on remembering which side of it you are on.
  const searching = query.trim().length > 0
  const shown = threads
    .filter((thread) => (searching ? !thread.trashed || folder === "trash" : inFolder(thread, folder)))
    .filter((thread) => matches(thread, query))

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* This is the first sidebar */}
      {/* We disable collapsible and adjust width to icon. */}
      {/* This will make the sidebar appear as icons. */}
      <Sidebar
        collapsible="none"
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <a href="/agents">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Command className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">govblock</span>
                    <span className="truncate text-xs">Agentic Inbox</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {/* Compose sits above the folders, where mail clients put it. */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={{ children: "Compose", hidden: false }}
                    onClick={onCompose}
                    className="px-2.5 text-primary md:px-2"
                  >
                    <PenSquare />
                    <span>Compose</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {FOLDERS.map((item) => {
                  const unread = unreadIn(threads, item.folder)
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        tooltip={{
                          children: unread ? `${item.title} (${unread})` : item.title,
                          hidden: false,
                        }}
                        onClick={() => {
                          onFolder(item.folder)
                          setOpen(true)
                        }}
                        isActive={folder === item.folder}
                        className="px-2.5 md:px-2"
                      >
                        <item.icon />
                        <span>{item.title}</span>
                        {unread > 0 && (
                          <span className="ml-auto text-xs tabular-nums">{unread}</span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser
            user={{
              name: "This browser",
              email: `${threads.length} thread${threads.length === 1 ? "" : "s"} kept locally`,
              avatar: "",
            }}
            onClear={onClear}
          />
        </SidebarFooter>
      </Sidebar>

      {/* This is the second sidebar */}
      {/* We disable collapsible and let it fill remaining space */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium text-foreground">
              {searching ? "All mail" : active.title}
            </div>
            {/* No unread toggle. Unread is something a row looks like, the way
                it is in every mail client — a filter for it is a control that
                exists because the appearance was not doing its job. */}
          </div>
          <SidebarInput
            placeholder="Search mail…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              {shown.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  {searching
                    ? `Nothing matches “${query.trim()}”.`
                    : folder === "inbox"
                      ? "Nothing has arrived yet. Compose a task and the reply lands here."
                      : "Nothing here."}
                </p>
              )}
              {shown.map((thread) => {
                // Unread is the arriving reply, never your own message — a
                // thread you composed is born read on your side.
                const unread = isUnread(thread)
                return (
                  <button
                    type="button"
                    key={thread.id}
                    onClick={() => onOpenThread(thread.id)}
                    data-active={selected === thread.id}
                    data-unread={unread}
                    className={cn(
                      "flex w-full flex-col items-start gap-2 border-b p-4 text-left text-sm leading-tight whitespace-nowrap transition-colors last:border-b-0",
                      // Unread reads as a card that has not been touched: the
                      // background comes forward and the type thickens. Read
                      // recedes. No toggle — the row says which it is.
                      unread
                        ? "bg-background shadow-[inset_2px_0_0_0_var(--color-primary)]"
                        : "bg-sidebar-accent/40 text-muted-foreground",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    )}
                  >
                    <div className="flex w-full items-center gap-2">
                      <span className={cn(unread ? "font-semibold text-foreground" : "font-normal")}>
                        {/* Sent reads "To: <Agent>", the way a Sent folder does
                            — the recipient is the useful name there. */}
                        {folder === "sent" || folder === "drafts"
                          ? `To: ${thread.agentName}`
                          : thread.agentName}
                      </span>
                      {thread.starred && (
                        <Star className="size-3 fill-yellow-400 text-yellow-500" />
                      )}
                      <span className="ml-auto text-xs">{when(thread.updatedAt)}</span>
                    </div>
                    <span
                      className={cn(
                        "w-[260px] truncate",
                        unread ? "font-semibold text-foreground" : "font-medium"
                      )}
                    >
                      {thread.subject}
                    </span>
                    <span className="line-clamp-2 flex w-[260px] items-start gap-1.5 text-xs whitespace-break-spaces">
                      {thread.status === "running" && (
                        // A running task must never be mistaken for a finished
                        // one. The dot pulses beside whatever tool is in flight.
                        <span
                          aria-hidden
                          className="mt-1 size-1.5 shrink-0 animate-pulse rounded-full bg-primary"
                        />
                      )}
                      <span className={thread.status === "running" ? "animate-pulse" : undefined}>
                        {thread.status === "draft" && "Draft · "}
                        {thread.status === "failed" && "Failed · "}
                        {thread.status === "running" ? running(thread) : teaser(thread)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
