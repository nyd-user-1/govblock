"use client"

import * as React from "react"
import Link from "next/link"
import { BadgeCheckIcon, BellIcon, ChevronsUpDownIcon, CreditCardIcon, LogInIcon, LogOutIcon, UserIcon } from "lucide-react"

import { signOutToLanding } from "@/app/actions/sign-out"
import { DEFAULT_AVATAR, useAccount } from "@/lib/auth/use-account"
import { forgetAccount } from "@/components/sign-out-button"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/ny4/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@govblock/ui/components/ny4/sidebar"

// The account block at the foot of a rail — the dashboard's, and since
// 2026-09-07 the inbox's too (Brendan: "both should match the /dashboard
// sidebar"). `go` opens a settings page by its dashboard id.
//
// The account is the reader's own (Brendan, 2026-09-21; John Doe stood here
// until then): the name, the address and the portrait the header's menu
// shows, Sign Out the same server action, and signed out the block is the
// way to sign in.

/** The demo account the dashboard's sample pages still print. */
export const ADMIN_USER = { name: "John Doe", email: "john@example.com", avatar: "" }

export function AccountFooter({ go }: { go: (page: string) => void }) {
  const { isMobile } = useSidebar()
  const { account } = useAccount()
  if (!account)
    return (
      <SidebarFooter className="p-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/sign-in" className="no-underline">
                <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <LogInIcon className="size-4" />
                </span>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Sign In</span>
                  <span className="truncate text-xs text-muted-foreground">Congress and your home state</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    )
  const name = account.name ?? account.email ?? "Account"
  const user = { name, email: account.email ?? "", avatar: account.image ?? DEFAULT_AVATAR, initial: name.slice(0, 1).toUpperCase() }
  return (
    <SidebarFooter className="p-1">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <Avatar className="size-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>{user.initial}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
                <ChevronsUpDownIcon className="ms-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side={isMobile ? "bottom" : "top"} align="start" sideOffset={4}>
              <div className="flex items-center gap-2.5 p-2 text-left text-sm">
                <Avatar className="size-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>{user.initial}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
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
              {/* The header menu's sign-out: the server action, with the browser's memory of the account cleared on the way. */}
              <form action={signOutToLanding}>
                <DropdownMenuItem variant="destructive" asChild onClick={forgetAccount} className="w-full whitespace-nowrap">
                  <button type="submit">
                    <LogOutIcon />
                    <span>Sign Out</span>
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
