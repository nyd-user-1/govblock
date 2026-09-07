"use client"

import * as React from "react"
import { BadgeCheckIcon, BellIcon, ChevronRightIcon, ChevronsUpDownIcon, CreditCardIcon, LogOutIcon, UserIcon } from "lucide-react"

import { ADMIN_MENU, type MenuItem } from "@/components/admin/items"
import { useAdminNav } from "@/components/admin/nav"
import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/ny4/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@govblock/ui/components/ny4/collapsible"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, useSidebar } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// paceui's DemoAdminSidebar, in the block shell's rail (Brendan, 2026-09-05:
// "all of this just goes in the left rail"). The header, the sectioned menu
// with its dots and its nested collapsibles, and the account footer with its
// menu — on our sidebar primitives, navigating the stage instead of the
// router. The account is the site's demo account until sign-in reaches the
// experience.

export const ADMIN_USER = { name: "John Doe", email: "john@example.com", avatar: "" }

function Tag({ tag }: { tag?: MenuItem["tag"] }) {
  if (tag === "coming-soon") return <div title="Coming Soon" className="size-1.5 rounded-full bg-foreground/20 transition-all delay-100 duration-300 group-hover/sub-item:w-3 group-hover/sub-item:bg-foreground/30" />
  if (tag === "new") return <div title="New" className="size-1.5 rounded-full bg-primary/60 transition-all delay-100 duration-300 group-hover/sub-item:w-3 group-hover/sub-item:bg-primary" />
  if (tag === "trend") return <div title="Trending" className="size-1.5 rounded-full bg-red-500/60 transition-all delay-100 duration-300 group-hover/sub-item:w-3 group-hover/sub-item:bg-red-500" />
  return null
}

function holds(item: MenuItem, page: string): boolean {
  if (item.page != null && item.page === page) return true
  return item.items?.some((sub) => holds(sub, page)) ?? false
}

function NavItem({ item, depth = 0 }: { item: MenuItem; depth?: number }) {
  const { page, go } = useAdminNav()
  const active = holds(item, page)
  const [open, setOpen] = React.useState(active)
  React.useEffect(() => {
    if (active) setOpen(true)
  }, [active])

  if (item.isTitle) return <SidebarMenuItem className="mb-1 px-2 text-xs font-semibold tracking-wide text-foreground/60 uppercase not-first:mt-4">{item.label}</SidebarMenuItem>

  if (!item.items) {
    return (
      <SidebarMenuItem className="group/sub-item px-0">
        <SidebarMenuButton isActive={active} className={cn("h-8 px-2.5 py-2", active && "font-medium", item.page == null && "bg-transparent! opacity-80")} onClick={() => item.page != null && go(item.page)}>
          {item.icon && <item.icon />}
          <p className="grow">{item.label}</p>
          {item.tag && (
            <div className="inline-flex">
              <Tag tag={item.tag} />
            </div>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild className="group/collapsible">
      <SidebarMenuItem className="px-0.5">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className={cn("group/sub-item h-8 px-2.5", active && "font-medium")}>
            {item.icon && <item.icon />}
            <span>{item.label}</span>
            <div className="ms-auto flex items-center gap-2">
              {item.tag && (
                <div className="inline-flex">
                  <Tag tag={item.tag} />
                </div>
              )}
              <ChevronRightIcon className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </div>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="group/menu-sub me-0 gap-0.5 ps-2 pe-0">
            {item.items.map((sub, i) => (
              <NavItem item={sub} key={i} depth={depth + 1} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function AdminRail() {
  const { go } = useAdminNav()
  const { isMobile } = useSidebar()
  return (
    <>
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        {/* Brendan, 2026-09-07: the word alone, no blue tile before it. */}
        <button type="button" className="flex items-center gap-2.5" onClick={() => go("")}>
          <p className="text-xl font-semibold">Admin</p>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="mt-2 mb-2 gap-0.5 px-2">
          {ADMIN_MENU.map((item, i) => (
            <NavItem item={item} key={i} />
          ))}
        </SidebarMenu>
      </SidebarContent>
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
    </>
  )
}
