"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { hasItems, siteConfig, type NavLink } from "@/lib/config"
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
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "@govblock/ui/components/ny4/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// Ported from livingston-v3 components/policy/directory-rail.tsx. Three groups,
// one item shape: the site's four sections with Records opened to its pages
// (read from the nav, so the rail and the Records panel are one list), Recent
// Bills (the number; the title is the tooltip), Committees (the name; the full
// name is the tooltip).

const MENU_CLASS =
  "relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent 3xl:fixed:w-full 3xl:fixed:max-w-48"

// Rows that carry a description fill the rail so the text ellipsizes inside
// the hover pill instead of running off its right edge.
const WIDE_CLASS = MENU_CLASS.replace("w-fit", "w-full max-w-52")

const print = (number: string) => number.replace(/^([A-Z]+)0+/, "$1")

// The four sections in the order Brendan gave them (2026-09-02, 20:00 ET),
// each standing for the top-level nav entry named in `nav`. Only Records
// lists its pages: it is the section every docs page belongs to, so its
// contents are the table of contents. The other three are one link each.
const SECTIONS = [
  { label: "Agents", nav: "Agents" },
  { label: "News", nav: "News Room" },
  { label: "Records", nav: "Records" },
  { label: "Workspace", nav: "Workspace" },
]

type RailItem = {
  key: string
  href: string
  label: React.ReactNode
  tooltip?: string
  active: boolean
  wide?: boolean
  items?: RailItem[]
}

function RailButton({ item }: { item: RailItem }) {
  const button = (
    <SidebarMenuButton asChild isActive={item.active} className={item.wide ? WIDE_CLASS : MENU_CLASS}>
      <Link href={item.href}>
        <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
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

function RailGroup({ label, items, className }: { label?: string; items: RailItem[]; className?: string }) {
  return (
    <SidebarGroup className={className}>
      {label && <SidebarGroupLabel className="font-medium text-muted-foreground">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.key}>
              <RailButton item={item} />
              {item.items && item.items.length > 0 && (
                <SidebarMenuSub>
                  {item.items.map((sub) => (
                    <SidebarMenuSubItem key={sub.key}>
                      <RailButton item={sub} />
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
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
  const topLevel = new Set(siteConfig.navItems.map((item) => item.href))

  const sections: RailItem[] = SECTIONS.flatMap(({ label, nav }) => {
    const entry = siteConfig.navItems.find((item) => item.label === nav)
    if (!entry) return []
    const pages: NavLink[] = hasItems(entry) ? entry.items : []
    // A page that already stands at the top of this rail is not listed a
    // second time under Records — News Room sits in the panel as well as
    // beside it, and here News is the row above.
    const shown = nav === "Records" ? pages.filter((page) => !topLevel.has(page.href)) : []
    const items = shown.map((page) => ({
      key: page.href,
      href: scoped(page.href),
      label: page.label,
      active: pathname.startsWith(page.href),
    }))
    const inside = pathname === entry.href || pages.some((page) => pathname.startsWith(page.href))
    return [
      {
        key: nav,
        href: scoped(entry.href),
        label,
        // A section lights up when the reader is inside it and none of its
        // listed pages has taken the highlight: Records yields to Bills,
        // Agents lights up for any agent.
        active: inside && !items.some((item) => item.active),
        items,
      },
    ]
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
      <RailGroup items={sections} className="pt-12" />
      <RailGroup label="Recent Bills" items={bills} />
      <RailGroup label="Committees" items={committees} />
    </>
  )
}
