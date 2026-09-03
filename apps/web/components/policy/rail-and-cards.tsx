"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"
import { BlockShell } from "@/components/policy/block-shell"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"

// The shape Brendan saw when he took the month calendar out of sidebar-12: a
// rail of categories on the left, a grid of appropriately sized cards on the
// right. It suits everything we hold that comes in categories — committees,
// members, bills, reports, PDFs, forms, applications — so it is built once
// here and instantiated per subject.
//
// Since 2026-09-03 the rail and the grid sit in `BlockShell`, the dashboard's
// shell, so every block has the same header and the same sidebar and the
// customizer's scope governs them all. The rail's items are one line each
// (Piece 7.8): `truncate` with the full text in `title`, because "Governmental
// Employees and Military and Veterans Affairs" wrapped to four lines and
// pushed the rail apart.

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
  actions,
  children,
  className,
}: {
  groups: RailGroup[]
  selected: string
  onSelect: (value: string) => void
  search?: string
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  /** The header's title: a name, a count, whatever the subject needs. */
  header?: React.ReactNode
  /** Right-aligned in the header. */
  actions?: React.ReactNode
  /** The cards. */
  children: React.ReactNode
  className?: string
}) {
  return (
    <BlockShell
      title={header}
      actions={actions}
      rail={
        <>
          {onSearch && (
            <SidebarHeader className="p-2">
              <SidebarInput placeholder={searchPlaceholder} value={search ?? ""} onChange={(event) => onSearch(event.target.value)} aria-label={searchPlaceholder} />
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
                        <SidebarMenuButton isActive={item.value === selected} onClick={() => onSelect(item.value)} title={item.label} className="justify-between gap-2">
                          {/* One line, always. */}
                          <span className="truncate">{item.label}</span>
                          {item.hint && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.hint}</span>}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                    {!group.items.length && (
                      <SidebarMenuItem>
                        <span className="px-2 text-xs text-muted-foreground">Nothing here.</span>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </>
      }
    >
      <div className={cn("grid auto-rows-min grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3", className)}>{children}</div>
    </BlockShell>
  )
}
