"use client"

import * as React from "react"
import Link from "next/link"
import { Command, File, Inbox, PenSquare, Send, Star, Trash2 } from "lucide-react"

import { unreadIn, type Folder, type Thread } from "@/lib/agents/inbox"
import { NavUser } from "@/registry/blocks/sidebar-09/components/nav-user"
import { SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"

// The Agentic Inbox's rail: Compose above the folders, where mail clients put
// it, and the folders with their unread counts. Since 2026-09-03 it is the
// contents of the shared block shell's sidebar (`BlockShell`), the same
// sidebar every block wears, rather than a sidebar of its own — so the rail
// has room for the folder names, and the thread list and the reading pane
// share the inset pane beside it.

const FOLDERS: { title: string; icon: typeof Inbox; folder: Folder }[] = [
  { title: "Inbox", icon: Inbox, folder: "inbox" },
  { title: "Sent", icon: Send, folder: "sent" },
  { title: "Drafts", icon: File, folder: "drafts" },
  { title: "Starred", icon: Star, folder: "starred" },
  { title: "Trash", icon: Trash2, folder: "trash" },
]

export function InboxRail({ threads, folder, onFolder, onCompose, onClear }: { threads: Thread[]; folder: Folder; onFolder: (folder: Folder) => void; onCompose: () => void; onClear: () => void }) {
  return (
    <>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
              <Link href="/agents">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">govblock</span>
                  <span className="truncate text-xs">Inbox</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onCompose} className="text-primary">
                  <PenSquare />
                  <span>Compose</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {FOLDERS.map((item) => {
                const unread = unreadIn(threads, item.folder)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton onClick={() => onFolder(item.folder)} isActive={folder === item.folder} title={unread ? `${item.title} (${unread})` : item.title}>
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
    </>
  )
}
