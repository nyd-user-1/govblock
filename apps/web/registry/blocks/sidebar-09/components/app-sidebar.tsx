"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { File, Inbox, PenSquare, Send, Star, Trash2 } from "lucide-react"

import { unreadIn, type Folder, type Thread } from "@/lib/agents/inbox"
import { AccountFooter } from "@/components/admin/account-footer"
import { dashboardHref } from "@/lib/workspace/dashboard"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"

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

export function InboxRail({ threads, folder, onFolder, onCompose }: { threads: Thread[]; folder: Folder; onFolder: (folder: Folder) => void; onCompose: () => void }) {
  const router = useRouter()
  return (
    <>
      {/* The dashboard rail's header: the word alone (Brendan, 2026-09-07: "both should match the /dashboard sidebar"). */}
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        <Link href="/workspace/inbox" className="flex items-center gap-2.5">
          <p className="text-xl font-semibold">Inbox</p>
        </Link>
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
      {/* The dashboard rail's account block; its menu opens the dashboard's settings pages. */}
      <AccountFooter go={(page) => router.push(dashboardHref(page))} />
    </>
  )
}
