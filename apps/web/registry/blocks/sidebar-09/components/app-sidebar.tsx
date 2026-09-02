"use client"

import * as React from "react"
import { Command, File, Inbox, PenSquare, Send, Star, Trash2 } from "lucide-react"

import { unreadIn, type Folder, type Thread } from "@/lib/agents/inbox"
import { NavUser } from "@/registry/blocks/sidebar-09/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@govblock/ui/components/ny4/sidebar"

// The Agentic Inbox's rail: shadcn's sidebar-09 first sidebar, markup and
// classNames intact, its contents replaced — Compose above the folders, where
// mail clients put it, and the folders with their unread counts. The thread
// list that used to be nested beside it is its own pane now
// (`thread-list.tsx`), so the list and the reading pane can share a resizable
// row the way shadcn's mail example does.

const FOLDERS: { title: string; icon: typeof Inbox; folder: Folder }[] = [
  { title: "Inbox", icon: Inbox, folder: "inbox" },
  { title: "Sent", icon: Send, folder: "sent" },
  { title: "Drafts", icon: File, folder: "drafts" },
  { title: "Starred", icon: Star, folder: "starred" },
  { title: "Trash", icon: Trash2, folder: "trash" },
]

export function AppSidebar({
  threads,
  folder,
  onFolder,
  onCompose,
  onClear,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  threads: Thread[]
  folder: Folder
  onFolder: (folder: Folder) => void
  onCompose: () => void
  onClear: () => void
}) {
  return (
    <Sidebar
      collapsible="none"
      className="w-[calc(var(--sidebar-width-icon)+1px)]! shrink-0 border-r"
      {...props}
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
                      onClick={() => onFolder(item.folder)}
                      isActive={folder === item.folder}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                      {unread > 0 && <span className="ml-auto text-xs tabular-nums">{unread}</span>}
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
  )
}
