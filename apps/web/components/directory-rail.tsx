"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
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

// Rows that carry a description fill the rail so the text ellipsizes inside
// the hover pill instead of running off its right edge.
const WIDE_CLASS = MENU_CLASS.replace("w-fit", "w-full max-w-52")

const print = (number: string) => number.replace(/^([A-Z]+)0+/, "$1")

type RailItem = { key: string; href: string; label: React.ReactNode; tooltip?: string; active: boolean; wide?: boolean }

function RailGroup({ label, items, className }: { label: string; items: RailItem[]; className?: string }) {
  return (
    <SidebarGroup className={className}>
      <SidebarGroupLabel className="font-medium text-muted-foreground">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const button = (
              <SidebarMenuButton asChild isActive={item.active} className={item.wide ? WIDE_CLASS : MENU_CLASS}>
                <Link href={item.href}>
                  <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
                  <span className="min-w-0 truncate">{item.label}</span>
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

type Committee = { committee_name: string; chamber: string; bills: number }

export function DirectoryRail() {
  const pathname = usePathname()
  const { data: billData, state } = useScoped<{ rows: typeof F.recentBills }>("bills", { rows: F.recentBills }, { limit: 12 })
  const { data: committeeData } = useScoped<Committee[]>("committees", F.committeesAll)
  const scope = `?state=${state}`

  const directory: RailItem[] = [
    { key: "bills", href: `/docs/bills${scope}`, label: "Bills", active: pathname.startsWith("/docs/bills") },
    { key: "committees", href: `/docs/committees${scope}`, label: "Committees", active: pathname.startsWith("/docs/committees") },
    { key: "members", href: `/docs/directory${scope}`, label: "Members", active: pathname.startsWith("/docs/members") || pathname.startsWith("/docs/directory") },
    { key: "money", href: `/docs/money${scope}`, label: "Finance", active: pathname.startsWith("/docs/money") },
  ]
  const bills: RailItem[] = (billData?.rows ?? []).slice(0, 12).map((bill) => ({
    key: String(bill.bill_id),
    href: `/docs/bills/${bill.bill_id}`,
    label: (
      <>
        <span className="font-mono text-[0.75rem]">{print(bill.bill_number)}</span>{" "}
        <span className="font-normal text-muted-foreground">{truncate(bill.title, 40)}</span>
      </>
    ),
    tooltip: bill.title,
    active: pathname === `/docs/bills/${bill.bill_id}`,
    wide: true,
  }))
  const committees: RailItem[] = [...(committeeData ?? [])]
    .sort((a, b) => a.committee_name.localeCompare(b.committee_name))
    .map((c) => ({
      key: `${c.chamber}/${c.committee_name}`,
      href: `/docs/bills${scope}&committee=${encodeURIComponent(c.committee_name)}`,
      label: truncate(c.committee_name, 40),
      tooltip: c.committee_name,
      active: false,
      wide: true,
    }))

  return (
    <>
      <RailGroup label="Directory" items={directory} className="pt-12" />
      <RailGroup label="Recent Bills" items={bills} />
      <RailGroup label="Committees" items={committees} />
    </>
  )
}
