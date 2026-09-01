"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import * as F from "@/lib/fixtures"
import { truncate } from "@/lib/format"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@govblock/ui/components/ny4/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// Ported from livingston-v3 components/policy/directory-rail.tsx. Three groups,
// one item shape: Directory, Recent Bills (the number; the title is the
// tooltip), Committees (the name; the full name is the tooltip).

const MENU_CLASS =
  "relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent 3xl:fixed:w-full 3xl:fixed:max-w-48"

const print = (number: string) => number.replace(/^([A-Z]+)0+/, "$1")

type RailItem = { key: string; href: string; label: string; tooltip?: string; active: boolean }

function RailGroup({ label, items, className }: { label: string; items: RailItem[]; className?: string }) {
  return (
    <SidebarGroup className={className}>
      <SidebarGroupLabel className="font-medium text-muted-foreground">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const button = (
              <SidebarMenuButton asChild isActive={item.active} className={MENU_CLASS}>
                <Link href={item.href}>
                  <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </SidebarMenuButton>
            )
            return (
              <SidebarMenuItem key={item.key}>
                {item.tooltip ? (
                  <Tooltip>
                    <TooltipTrigger render={button} />
                    <TooltipContent side="right" className="max-w-72 text-pretty">
                      {item.tooltip}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  button
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function DirectoryRail() {
  const pathname = usePathname()
  const state = F.STATE
  const scope = `?state=${state}`

  const directory: RailItem[] = [
    { key: "bills", href: `/docs/bills${scope}`, label: "Bills", active: pathname.startsWith("/docs/bills") },
    { key: "committees", href: `/docs/committees${scope}`, label: "Committees", active: pathname.startsWith("/docs/committees") },
    { key: "members", href: `/docs/directory${scope}`, label: "Members", active: pathname.startsWith("/docs/members") || pathname.startsWith("/docs/directory") },
    { key: "money", href: `/docs/money${scope}`, label: "Federal money", active: pathname.startsWith("/docs/money") },
  ]
  const bills: RailItem[] = F.recentBills.slice(0, 12).map((bill) => ({
    key: String(bill.bill_id),
    href: `/docs/bills/${bill.bill_id}`,
    label: print(bill.bill_number),
    tooltip: bill.title,
    active: pathname === `/docs/bills/${bill.bill_id}`,
  }))
  const committees: RailItem[] = [...F.committeesAll]
    .sort((a, b) => a.committee_name.localeCompare(b.committee_name))
    .slice(0, 12)
    .map((c) => ({
      key: `${c.chamber}/${c.committee_name}`,
      href: `/docs/bills${scope}&committee=${encodeURIComponent(c.committee_name)}`,
      label: truncate(c.committee_name, 26),
      tooltip: c.committee_name,
      active: false,
    }))

  return (
    <>
      <RailGroup label="Directory" items={directory} className="pt-12" />
      <RailGroup label="Recent Bills" items={bills} />
      <RailGroup label="Committees" items={committees} />
    </>
  )
}
