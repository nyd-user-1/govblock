"use client"

import * as React from "react"
import Link from "next/link"
import { PlusIcon, SearchIcon } from "lucide-react"

import { Icons } from "@/components/icons"
import { Sidebar, SidebarContent } from "@govblock/ui/components/ny4/sidebar"
import { Button } from "@govblock/ui/components/nova/button"
import { Kbd, KbdGroup } from "@govblock/ui/components/nova/kbd"
import { Separator } from "@govblock/ui/components/nova/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@govblock/ui/components/nova/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@govblock/ui/components/nova/tooltip"

import { CalendarList } from "./calendar-list"
import { useCalendar, useEventDraft } from "./calendar-provider"
import { MiniCalendar } from "./mini-calendar"
import { UserMenu } from "./user-menu"

// The rail's content, shared by the docs-style rail on desktop and the sheet
// below `lg`.
function RailContent() {
  const { setSearchOpen } = useCalendar()
  const { createAtAnchor } = useEventDraft()

  return (
    <div className="flex h-full flex-col gap-5 pr-4">
      <div className="flex items-center gap-1">
        <Link
          href="/calendar"
          aria-label="Home"
          className="flex items-center gap-1.5 rounded-md text-foreground outline-primary/25 focus-visible:outline-3"
        >
          <Icons.logo className="size-5 shrink-0" />
          <span className="text-lg font-bold">Calendar</span>
        </Link>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                aria-label="New event"
                className="ml-auto rounded-full"
                onClick={() => createAtAnchor()}
              />
            }
          >
            <PlusIcon />
          </TooltipTrigger>
          <TooltipContent>
            New event <Kbd>N</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      <Button
        variant="secondary"
        className="w-full justify-start"
        onClick={() => setSearchOpen(true)}
      >
        <SearchIcon />
        Search
        <KbdGroup className="ml-auto hidden lg:inline-flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>

      <CalendarList />

      <Separator className="mt-auto" />

      <MiniCalendar />

      <UserMenu />
    </div>
  )
}

export function AppSidebar({
  menuOpen,
  onMenuOpenChange,
}: {
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}) {
  return (
    <>
      <Sidebar
        className="sticky top-[calc(var(--header-height)+0.6rem)] z-30 hidden h-[calc(100svh-var(--header-height)-1.2rem)] overflow-hidden overscroll-none bg-transparent [--sidebar-menu-width:--spacing(56)] lg:flex"
        collapsible="none"
      >
        <div className="absolute top-12 right-2 bottom-0 hidden h-full w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_10%,var(--border)_90%,transparent_100%)] lg:flex" />
        <SidebarContent className="w-(--sidebar-menu-width) scrollbar-none overflow-x-hidden pt-12 pb-2 pl-2.5">
          <RailContent />
        </SidebarContent>
      </Sidebar>

      <Sheet open={menuOpen} onOpenChange={onMenuOpenChange}>
        <SheetContent side="left" className="w-72 p-4 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Calendar navigation</SheetDescription>
          </SheetHeader>
          <RailContent />
        </SheetContent>
      </Sheet>
    </>
  )
}
