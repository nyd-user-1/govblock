"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@govblock/ui/components/nova/sidebar"

// The shape Brendan saw when he took the month calendar out of sidebar-12: a
// rail of categories on the left, a grid of appropriately sized cards on the
// right. It suits everything we hold that comes in categories — committees,
// members, bills, reports, PDFs, forms, applications — so it is built once
// here and instantiated per subject.
//
// The rail's items are one line each (Piece 7.8): `truncate` with the full
// text in `title`, because "Governmental Employees and Military and Veterans
// Affairs" wrapped to four lines and pushed the rail apart.
//
// Built on base-nova's primitives rather than the registry base's: those take
// their look from `cn-*` utilities that only exist inside a `.style-<name>`
// scope, and a block view does not provide one. base-nova's classes are
// literal, so this renders correctly wherever it is mounted.

export type RailItem = {
  value: string
  label: string
  /** Shown right-aligned — a count, usually. */
  hint?: string
}

export type RailGroup = {
  label: string
  items: RailItem[]
}

export function RailAndCards({
  groups,
  selected,
  onSelect,
  search,
  onSearch,
  searchPlaceholder = "Search…",
  header,
  children,
  className,
}: {
  groups: RailGroup[]
  selected: string
  onSelect: (value: string) => void
  search?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  /** Sits above the grid: a title, a count, whatever the subject needs. */
  header?: React.ReactNode
  /** The cards. */
  children: React.ReactNode
  className?: string
}) {
  return (
    <SidebarProvider className="min-h-svh">
      <Sidebar collapsible="none" className="border-r">
        {onSearch && (
          <SidebarHeader className="p-2">
            <SidebarInput
              placeholder={searchPlaceholder}
              value={search ?? ""}
              onChange={(event) => onSearch(event.target.value)}
              aria-label={searchPlaceholder}
            />
          </SidebarHeader>
        )}
        <SidebarContent>
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={`${group.label}:${item.value}`}>
                      <SidebarMenuButton
                        isActive={item.value === selected}
                        onClick={() => onSelect(item.value)}
                        title={item.label}
                        className="justify-between gap-2"
                      >
                        {/* One line, always. */}
                        <span className="truncate">{item.label}</span>
                        {item.hint && (
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {item.hint}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {!group.items.length && (
                    <SidebarMenuItem>
                      <span className="px-2 text-xs text-muted-foreground">
                        Nothing here.
                      </span>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>
      <div className="flex min-w-0 flex-1 flex-col">
        {header && (
          <div className="flex items-center gap-2 border-b px-4 py-3">
            {header}
          </div>
        )}
        <div
          className={cn(
            "grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-3",
            className
          )}
        >
          {children}
        </div>
      </div>
    </SidebarProvider>
  )
}
