"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { hasItems, siteConfig, type NavLink } from "@/lib/config"
import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { truncate } from "@/lib/format"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@govblock/ui/components/ny4/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "@govblock/ui/components/ny4/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// Ported from livingston-v3 components/policy/directory-rail.tsx. Three groups,
// one item shape: the site's four sections with Records folded to its pages
// (read from the nav, so the rail and the Records panel are one list), Recent
// Bills (the number; the title is the tooltip), Committees (the name; the full
// name is the tooltip). Every row's hover runs the width of the rail.

const MENU_CLASS =
  "relative h-[30px] w-full max-w-52 overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent 3xl:fixed:w-full 3xl:fixed:max-w-48"

const print = (number: string) => number.replace(/^([A-Z]+)0+/, "$1")

// The four sections in the order Brendan gave them (2026-09-02, 20:00 ET),
// each the top-level nav entry of the same name. Only Records lists its pages:
// it is the section every docs page belongs to, so its contents are the table
// of contents — folded until asked for (Brendan, 20:30 ET). The other three
// are one link each.
const SECTIONS = ["Agents", "News", "Records", "Workspace"]

type RailItem = {
  key: string
  href: string
  label: React.ReactNode
  tooltip?: string
  active: boolean
  items?: RailItem[]
}

function RailButton({ item }: { item: RailItem }) {
  const button = (
    <SidebarMenuButton asChild isActive={item.active} className={MENU_CLASS}>
      <Link href={item.href}>
        <span className="min-w-0 truncate">{item.label}</span>
      </Link>
    </SidebarMenuButton>
  )
  if (!item.tooltip) return button
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right" className="max-w-72 text-pretty">
        {item.tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

function RailNode({ item }: { item: RailItem }) {
  const [open, setOpen] = React.useState(false)
  const children = item.items ?? []
  if (!children.length) {
    return (
      <SidebarMenuItem>
        <RailButton item={item} />
      </SidebarMenuItem>
    )
  }
  // The section stands for the page while it is folded, or while it is open
  // with no listed page taking the highlight; open on a bill, Bills has it.
  const highlight = item.active && !(open && children.some((child) => child.active))
  return (
    <Collapsible asChild open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={highlight} className={MENU_CLASS}>
            <span className="min-w-0 truncate">{item.label}</span>
            <ChevronRight aria-hidden className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
              <SidebarMenuSubItem key={child.key}>
                <RailButton item={child} />
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function RailGroup({ label, items, className }: { label?: string; items: RailItem[]; className?: string }) {
  return (
    <SidebarGroup className={className}>
      {label && <SidebarGroupLabel className="font-medium text-muted-foreground">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <RailNode key={item.key} item={item} />
          ))}
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
  // Docs pages take the jurisdiction on the URL; the rest of the site reads it
  // from the browser.
  const scoped = (href: string) => (href.startsWith("/docs") ? `${href}${scope}` : href)

  const sections: RailItem[] = SECTIONS.flatMap((nav) => {
    const entry = siteConfig.navItems.find((item) => item.label === nav)
    if (!entry) return []
    const pages: NavLink[] = hasItems(entry) ? entry.items : []
    // A page that already stands at the top of this rail as another section
    // is not listed a second time under Records — News sits in the panel as
    // well as beside it, and here it is the row above. The section's own
    // link (Records opens on Bills) does not count against its list.
    const elsewhere = new Set(siteConfig.navItems.filter((item) => item !== entry).map((item) => item.href))
    const shown = nav === "Records" ? pages.filter((page) => !elsewhere.has(page.href)) : []
    const items = shown.map((page) => ({
      key: page.href,
      href: scoped(page.href),
      label: page.label,
      active: pathname.startsWith(page.href),
    }))
    const inside = pathname === entry.href || pages.some((page) => pathname.startsWith(page.href))
    return [{ key: nav, href: scoped(entry.href), label: nav, active: inside, items }]
  })
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
  }))
  const committees: RailItem[] = [...(committeeData ?? [])]
    .sort((a, b) => a.committee_name.localeCompare(b.committee_name))
    .map((c) => ({
      key: `${c.chamber}/${c.committee_name}`,
      href: `/docs/bills${scope}&committee=${encodeURIComponent(c.committee_name)}`,
      label: truncate(c.committee_name, 40),
      tooltip: c.committee_name,
      active: false,
    }))

  return (
    <>
      <RailGroup items={sections} className="pt-12" />
      <RailGroup label="Recent Bills" items={bills} />
      <RailGroup label="Committees" items={committees} />
    </>
  )
}
