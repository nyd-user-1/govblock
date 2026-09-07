"use client"

import * as React from "react"
import { BadgeCheckIcon, BellIcon, ChevronsUpDownIcon, CreditCardIcon, LogOutIcon, UserIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/ny4/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@govblock/ui/components/ny4/sidebar"

// The account block at the foot of a rail — the dashboard's, and since
// 2026-09-07 the inbox's too (Brendan: "both should match the /dashboard
// sidebar"). `go` opens a settings page by its dashboard id.

/** The site's demo account until sign-in reaches the experience. */
export const ADMIN_USER = { name: "John Doe", email: "john@example.com", avatar: "" }

export function AccountFooter({ go }: { go: (page: string) => void }) {
  const { isMobile } = useSidebar()
  return (
    <SidebarFooter className="p-1">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <Avatar className="size-8">
                  <AvatarImage src={ADMIN_USER.avatar} alt={ADMIN_USER.name} />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{ADMIN_USER.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{ADMIN_USER.email}</span>
                </div>
                <ChevronsUpDownIcon className="ms-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side={isMobile ? "bottom" : "top"} align="start" sideOffset={4}>
              <div className="flex items-center gap-2.5 p-2 text-left text-sm">
                <Avatar className="size-8">
                  <AvatarImage src={ADMIN_USER.avatar} alt={ADMIN_USER.name} />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{ADMIN_USER.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{ADMIN_USER.email}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => go("settings/profile")} className="whitespace-nowrap">
                  <UserIcon />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => go("settings/account-security")} className="whitespace-nowrap">
                  <BadgeCheckIcon />
                  <span>Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => go("settings/billing")} className="whitespace-nowrap">
                  <CreditCardIcon />
                  <span>Billing</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => go("settings/notifications")} className="whitespace-nowrap">
                  <BellIcon />
                  <span>Notifications</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => go("auth-1/login")} className="whitespace-nowrap">
                <LogOutIcon />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
