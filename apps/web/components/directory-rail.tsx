"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import * as F from "@/lib/fixtures"
import { usePolicy } from "@/lib/policy/use-policy"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtBill, fmtLongDate, truncate } from "@/lib/format"
import { cn } from "@govblock/ui/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@govblock/ui/components/ny4/collapsible"
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem } from "@govblock/ui/components/ny4/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// Ported from livingston-v3 components/policy/directory-rail.tsx: the rail's
// row (an icon, a label, a chevron on a node, a badge where a page is new or
// in beta, a second line where a row has one) and its groups, and the hook
// that reads the record's own groups — the page's bills, Recent Bills (the
// number, a date beneath; the title is the tooltip), Committees (the name;
// the full name is the tooltip). Since 2026-09-11 the one site rail
// (components/home/home-rail.tsx, Cloudflare's account rail in our terms)
// draws these under its sections on every page. Every row's hover runs the
// width of the rail.

const MENU_CLASS =
  "relative h-[30px] w-full max-w-52 overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent 3xl:fixed:w-full 3xl:fixed:max-w-48"

// `HB 10163`: the prefix and the number with a space between, leading zeros
// dropped, in the rail's own face rather than mono (Brendan, 23:10 ET).

export type RailItem = {
  key: string
  href: string
  label: React.ReactNode
  /** A small glyph before the label, as Cloudflare's rail draws one (the home rail, 2026-09-07). */
  icon?: React.ReactNode
  /** A second, smaller line under the label; the row grows to hold it. */
  detail?: React.ReactNode
  tooltip?: string
  /** A pill after the label — "New", "Beta" — as Cloudflare's and AnimBits' rails wear one. */
  badge?: string
  /** Drawn at half strength: something the reader is not entitled to yet (the home state, signed out). */
  muted?: boolean
  active: boolean
  items?: RailItem[]
}

function Badge({ text }: { text: string }) {
  return <span className="ml-1.5 shrink-0 rounded-full border border-dashed border-foreground/30 px-1.5 py-px text-[10px] font-medium tracking-wide text-muted-foreground">{text}</span>
}

function RailButton({ item }: { item: RailItem }) {
  const button = (
    <SidebarMenuButton asChild isActive={item.active} className={cn(MENU_CLASS, item.detail && "h-auto flex-col items-start gap-0 py-1.5", item.muted && "opacity-60")}>
      <Link href={item.href}>
        {item.icon}
        <span className="max-w-full min-w-0 truncate">{item.label}</span>
        {item.badge && <Badge text={item.badge} />}
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
          <SidebarMenuButton isActive={highlight} className={cn(MENU_CLASS, item.muted && "opacity-60")}>
            {item.icon}
            <span className="min-w-0 truncate">{item.label}</span>
            {item.badge && <Badge text={item.badge} />}
            <ChevronRight aria-hidden className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {/* AnimBits' three levels (Brendan, 2026-09-11): a child with items of its own is a node again, folded the same way. */}
          <SidebarMenuSub>
            {children.map((child) =>
              child.items?.length ? (
                <RailNode key={child.key} item={child} />
              ) : (
                <SidebarMenuSubItem key={child.key}>
                  <RailButton item={child} />
                </SidebarMenuSubItem>
              )
            )}
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

type RailBill = { bill_id: number; bill_number: string; title: string; last_action_date: string | null; introduced?: string | null }
type RailData = { label?: string; pending?: RailBill[]; recent?: RailBill[]; sponsored?: RailBill[]; introduced?: RailBill[] }

export type RecordGroup = { key: string; label: string; items: RailItem[] }

/**
 * The record's groups for the rail: on a committee's or a member's page their
 * own bills first — pending and recent for a committee, sponsored for a member
 * (Brendan, 2026-09-06) — then the jurisdiction's Recent Bills and its
 * Committees. On the bills pages Recent Bills are the recently introduced
 * ones, and /bills/ny reads New York whatever the header's flag says
 * (2026-09-11).
 */
export function useRecordGroups(): RecordGroup[] {
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
  // The id comes off the path; the resource resolves it, so the rail never
  // guesses the jurisdiction from the URL's scope.
  const committeeId = pathname.match(/^\/committees\/([^/?#]+)/)?.[1] ?? null
  const memberId = pathname.match(/^\/members\/(\d+)/)?.[1] ?? null
  const { data: own } = usePolicy<RailData>(committeeId || memberId ? "rail" : null, { state }, { committee: committeeId ?? undefined, member: memberId ?? undefined, session })
  const billsState = pathname.match(/^\/bills\/([a-z]{2})$/i)?.[1]?.toUpperCase() ?? null
  const onBills = pathname === "/bills" || !!billsState
  const { data: intro } = usePolicy<RailData>(onBills ? "rail" : null, { state: billsState ?? state }, { introduced: "1", session: billsState ? undefined : session })
  const scope = `?state=${state}`

  const billItem = (bill: RailBill, prefix = ""): RailItem => ({
    key: `${prefix}${bill.bill_id}`,
    href: `/bills/${bill.bill_id}`,
    label: fmtBill(bill.bill_number, billsState ?? state),
    // The day it last moved, written out (Brendan, 2026-09-03); the day it was introduced, in the introduced list.
    detail: bill.introduced ? fmtLongDate(bill.introduced) : bill.last_action_date ? fmtLongDate(bill.last_action_date) : null,
    tooltip: bill.title,
    active: pathname === `/bills/${bill.bill_id}`,
  })
  const bills: RailItem[] = (billData?.rows ?? []).slice(0, 12).map((bill) => billItem(bill as RailBill))
  const pending: RailItem[] = (own?.pending ?? []).map((bill) => billItem(bill, "p-"))
  const recent: RailItem[] = (own?.recent ?? []).map((bill) => billItem(bill, "r-"))
  const sponsored: RailItem[] = (own?.sponsored ?? []).map((bill) => billItem(bill, "s-"))
  const introduced: RailItem[] = (intro?.introduced ?? []).map((bill) => billItem(bill, "i-"))
  const committees: RailItem[] = [...(committeeData ?? [])]
    .sort((a, b) => a.committee_name.localeCompare(b.committee_name))
    .map((c) => ({
      key: `${c.chamber}/${c.committee_name}`,
      href: `/bills${scope}&committee=${encodeURIComponent(c.committee_name)}`,
      label: truncate(c.committee_name, 40),
      // The chamber under the name (Brendan, 2026-09-12): Assembly and Senate
      // both have an Environmental Conservation, and without it they read as
      // one committee listed twice.
      detail: `${state === "NY" ? "NYS" : state === "US" ? "U.S." : state} ${c.chamber}`,
      tooltip: `${c.committee_name} · ${c.chamber}`,
      active: false,
    }))

  const groups: RecordGroup[] = []
  if (pending.length) groups.push({ key: "pending", label: "Pending Bills", items: pending })
  if (recent.length) groups.push({ key: "committee", label: "Committee Bills", items: recent })
  if (sponsored.length) groups.push({ key: "sponsored", label: "Sponsored Bills", items: sponsored })
  groups.push({ key: "recent", label: "Recent Bills", items: onBills && introduced.length ? introduced : bills })
  groups.push({ key: "committees", label: "Committees", items: committees })
  return groups
}
