"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { hasItems, isScoped, siteConfig, type NavLink } from "@/lib/config"
import * as F from "@/lib/fixtures"
import { usePolicy } from "@/lib/policy/use-policy"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtBill, fmtLongDate, truncate } from "@/lib/format"
import { cn } from "@govblock/ui/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@govblock/ui/components/ny4/collapsible"
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem } from "@govblock/ui/components/ny4/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// Ported from livingston-v3 components/policy/directory-rail.tsx. Three groups,
// one item shape: the site's four sections with Records folded to its pages
// (read from the nav, so the rail and the Records panel are one list), Recent
// Bills (the number, the date of its latest action beneath; the title is the
// tooltip),
// Committees (the name; the full name is the tooltip). Every row's hover runs
// the width of the rail.

const MENU_CLASS =
  "relative h-[30px] w-full max-w-52 overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent 3xl:fixed:w-full 3xl:fixed:max-w-48"

// `HB 10163`: the prefix and the number with a space between, leading zeros
// dropped, in the rail's own face rather than mono (Brendan, 23:10 ET).

// The four sections in the order Brendan gave them (2026-09-02, 20:00 ET),
// each the top-level nav entry of the same name. Only Records lists its pages:
// it is the section every docs page belongs to, so its contents are the table
// of contents — folded until asked for (Brendan, 20:30 ET). The other three
// are one link each.
const SECTIONS = ["Agents", "News", "Records", "Workspace"]

export type RailItem = {
  key: string
  href: string
  label: React.ReactNode
  /** A small glyph before the label, as Cloudflare's rail draws one (the home rail, 2026-09-07). */
  icon?: React.ReactNode
  /** A second, smaller line under the label; the row grows to hold it. */
  detail?: React.ReactNode
  tooltip?: string
  active: boolean
  items?: RailItem[]
}

function RailButton({ item }: { item: RailItem }) {
  const button = (
    <SidebarMenuButton asChild isActive={item.active} className={cn(MENU_CLASS, item.detail && "h-auto flex-col items-start gap-0 py-1.5")}>
      <Link href={item.href}>
        {item.icon}
        <span className="max-w-full min-w-0 truncate">{item.label}</span>
        {item.detail && <span className="mt-1 max-w-full min-w-0 truncate text-xs font-normal text-muted-foreground">{item.detail}</span>}
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
            {item.icon}
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

export function RailGroup({ label, items, className }: { label?: string; items: RailItem[]; className?: string }) {
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

type RailBill = { bill_id: number; bill_number: string; title: string; last_action_date: string | null }
type RailData = { label?: string; pending?: RailBill[]; recent?: RailBill[]; sponsored?: RailBill[] }

export function DirectoryRail() {
  const pathname = usePathname()
  // The session on the URL, read after mount: useSearchParams would make
  // every prerendered page that carries this rail bail to the client.
  const [session, setSession] = React.useState<string | undefined>(undefined)
  React.useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("session") ?? undefined
    setSession((current) => (current === value ? current : value))
  }, [pathname])
  const { data: billData, state } = useScoped<{ rows: typeof F.recentBills }>("bills", { rows: F.recentBills }, { limit: 12 })
  const { data: committeeData } = useScoped<Committee[]>("committees", F.committeesAll)
  // On a committee's or a member's page the rail opens with their own bills
  // — pending and recent for a committee, sponsored for a member — and the
  // jurisdiction's Recent Bills follow (Brendan, 2026-09-06). The id comes
  // off the path; the resource resolves it, so the rail never guesses the
  // jurisdiction from the URL's scope.
  const committeeId = pathname.match(/^\/committees\/([^/?#]+)/)?.[1] ?? null
  const memberId = pathname.match(/^\/members\/(\d+)/)?.[1] ?? null
  const { data: own } = usePolicy<RailData>(committeeId || memberId ? "rail" : null, { state }, { committee: committeeId ?? undefined, member: memberId ?? undefined, session })
  const scope = `?state=${state}`
  // Docs pages take the jurisdiction on the URL; the rest of the site reads it
  // from the browser.
  const scoped = (href: string) => (isScoped(href) ? `${href}${scope}` : href)

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
  const billItem = (bill: RailBill, prefix = ""): RailItem => ({
    key: `${prefix}${bill.bill_id}`,
    href: `/bills/${bill.bill_id}`,
    label: fmtBill(bill.bill_number, state),
    // The day it last moved, written out (Brendan, 2026-09-03).
    detail: bill.last_action_date ? fmtLongDate(bill.last_action_date) : null,
    tooltip: bill.title,
    active: pathname === `/bills/${bill.bill_id}`,
  })
  const bills: RailItem[] = (billData?.rows ?? []).slice(0, 12).map((bill) => billItem(bill as RailBill))
  const pending: RailItem[] = (own?.pending ?? []).map((bill) => billItem(bill, "p-"))
  const recent: RailItem[] = (own?.recent ?? []).map((bill) => billItem(bill, "r-"))
  const sponsored: RailItem[] = (own?.sponsored ?? []).map((bill) => billItem(bill, "s-"))
  const committees: RailItem[] = [...(committeeData ?? [])]
    .sort((a, b) => a.committee_name.localeCompare(b.committee_name))
    .map((c) => ({
      key: `${c.chamber}/${c.committee_name}`,
      href: `/bills${scope}&committee=${encodeURIComponent(c.committee_name)}`,
      label: truncate(c.committee_name, 40),
      tooltip: c.committee_name,
      active: false,
    }))

  // Account Home stands first, before Agents (Brendan, 2026-09-07).
  const home: RailItem = { key: "home", href: "/home", label: "Account Home", active: pathname === "/home" }
  return (
    <>
      <RailGroup items={[home, ...sections]} className="pt-12" />
      {pending.length > 0 && <RailGroup label="Pending Bills" items={pending} />}
      {recent.length > 0 && <RailGroup label="Committee Bills" items={recent} />}
      {sponsored.length > 0 && <RailGroup label="Sponsored Bills" items={sponsored} />}
      <RailGroup label="Recent Bills" items={bills} />
      <RailGroup label="Committees" items={committees} />
    </>
  )
}
