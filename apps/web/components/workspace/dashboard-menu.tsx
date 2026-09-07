"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LayoutDashboardIcon, type LucideIcon } from "lucide-react"

import { ADMIN_MENU, type MenuItem } from "@/components/admin/items"
import { adminTitle } from "@/components/admin/pages"
import { ADMIN_USER } from "@/components/admin/rail"
import { WorkspaceGrid, type GridItem } from "@/components/workspace/grid"
import { DashboardSketch, type SketchSpec } from "@/components/workspace/dashboard-sketch"
import { dashboardHref } from "@/lib/workspace/dashboard"
import { useUrlSearch } from "@/lib/policy/url-state"
import { Card, CardContent } from "@govblock/ui/components/nova/card"
import { DropdownMenuItem } from "@govblock/ui/components/dropdown-menu"

// /workspace/dashboard itself: the menu of every dashboard (Brendan,
// 2026-09-07). The Dashboards section is Cloudflare's dashboards menu inside
// our cards: on the standard workspace grid, each card a rough sketch of
// the dashboard — its stat tiles and its charts — then the name, how many
// charts it holds, and who made and last changed it. The other sections
// (Apps, Page, Components, Other) are one small card per page, as they were.

type Entry = { label: string; page: string; icon: LucideIcon; tag?: MenuItem["tag"] }
type Section = { label: string; entries: Entry[] }

/** Each dashboard's sketch and its record: the tiles and panels as the page draws them, the charts counted off the page, the dates off git. */
const DASHBOARDS: Record<string, { spec: SketchSpec; charts: number; created: string; updated: string }> = {
  "": { spec: { tiles: ["#", "#", "#", "#"], panels: ["bars", "list"] }, charts: 6, created: "2026-09-05", updated: "2026-09-07" },
  logs: { spec: { tiles: ["#", "#", "#", "%", "#"], panels: ["area", "list"] }, charts: 5, created: "2026-09-05", updated: "2026-09-07" },
  customers: { spec: { tiles: ["#", "#", "%"], panels: ["line", "bars"] }, charts: 4, created: "2026-09-05", updated: "2026-09-07" },
  orders: { spec: { tiles: ["#", "#", "%", "#"], panels: ["bars", "line"] }, charts: 4, created: "2026-09-05", updated: "2026-09-07" },
  traffic: { spec: { tiles: ["#", "#", "%", "#"], panels: ["area"] }, charts: 10, created: "2026-09-06", updated: "2026-09-07" },
  education: { spec: { tiles: ["#", "#", "%"], panels: ["bars", "list"] }, charts: 7, created: "2026-09-05", updated: "2026-09-07" },
  committee: { spec: { tiles: ["#", "#", "%"], panels: ["bars", "bars", "bars"] }, charts: 4, created: "2026-09-07", updated: "2026-09-07" },
  crypto: { spec: { tiles: ["#", "#", "#"], panels: ["line", "list"] }, charts: 7, created: "2026-09-05", updated: "2026-09-07" },
  database: { spec: { tiles: ["#", "#", "#", "#"], panels: ["bars", "area"] }, charts: 10, created: "2026-09-05", updated: "2026-09-07" },
  skeleton: { spec: { tiles: ["#", "#", "#"], panels: ["list"] }, charts: 0, created: "2026-09-05", updated: "2026-09-05" },
}

const LAYOUT_KEY = "govblock:workspace:dashboard:layout"

/** "today", "yesterday", "3 days ago", "a month ago": Cloudflare's tense. */
function ago(date: string) {
  const days = Math.max(0, Math.round((Date.now() - new Date(`${date}T12:00:00Z`).getTime()) / 86_400_000))
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  if (days < 60) return "a month ago"
  return `${Math.round(days / 30)} months ago`
}

function flatten(items: MenuItem[], prefix: string, icon: LucideIcon, tag?: MenuItem["tag"]): Entry[] {
  return items.flatMap((item) => {
    const label = prefix ? `${prefix} · ${item.label}` : item.label
    const own = item.icon ?? icon
    if (item.items) return flatten(item.items, label, own, item.tag ?? tag)
    if (item.page == null) return []
    return [{ label, page: item.page, icon: own, tag: item.tag ?? tag }]
  })
}

function sections(): Section[] {
  const out: Section[] = []
  for (const item of ADMIN_MENU) {
    if (item.isTitle) out.push({ label: item.label, entries: [] })
    else out[out.length - 1]?.entries.push(...flatten([item], "", LayoutDashboardIcon))
  }
  return out.filter((s) => s.entries.length)
}

function Dot({ tag }: { tag?: MenuItem["tag"] }) {
  if (tag === "coming-soon") return <span title="Coming Soon" className="size-1.5 rounded-full bg-foreground/20" />
  if (tag === "new") return <span title="New" className="size-1.5 rounded-full bg-primary/60" />
  if (tag === "trend") return <span title="Trending" className="size-1.5 rounded-full bg-red-500/60" />
  return null
}

/** The Dashboards section: the sketch cards on the workspace grid. */
function DashboardCards({ entries, search }: { entries: Entry[]; search: string }) {
  const router = useRouter()
  const items = React.useMemo<GridItem[]>(
    () =>
      entries.map((entry) => {
        const record = DASHBOARDS[entry.page] ?? { spec: { tiles: ["#", "#", "#"], panels: ["line"] as SketchSpec["panels"] }, charts: 0, created: "2026-09-05", updated: "2026-09-07" }
        const href = dashboardHref(entry.page, search)
        const explore = () => router.push(href)
        const share = () => navigator.clipboard?.writeText(`${window.location.origin}${href}`).catch(() => {})
        return {
          key: `dashboard-${entry.page || "sales"}`,
          group: "dashboards",
          badge: <Dot tag={entry.tag} />,
          media: <DashboardSketch spec={record.spec} />,
          title: adminTitle(entry.page),
          description: record.charts ? `${record.charts} charts` : "No charts yet",
          meta: `Created ${ago(record.created)} by ${ADMIN_USER.email} · Updated ${ago(record.updated)} by ${ADMIN_USER.email}`,
          actions: [
            { label: "Explore", onClick: explore },
            { label: "Share", onClick: share, title: "Copy the link" },
          ],
          menu: (
            <>
              <DropdownMenuItem onClick={explore}>Explore</DropdownMenuItem>
              <DropdownMenuItem onClick={share}>Copy link</DropdownMenuItem>
            </>
          ),
        }
      }),
    [entries, search, router]
  )
  return <WorkspaceGrid storageKey={LAYOUT_KEY} items={items} className="p-0" />
}

export function DashboardMenu() {
  const raw = useUrlSearch()
  const search = typeof raw === "string" ? raw : ""
  const groups = React.useMemo(sections, [])
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.label} className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-foreground/60 uppercase">{group.label}</h2>
          {group.label === "Dashboards" ? (
            <DashboardCards entries={group.entries} search={search} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {group.entries.map((entry) => {
                const title = adminTitle(entry.page)
                return (
                  <Link key={entry.page} href={dashboardHref(entry.page, search)} className="group/tile rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Card size="sm" className="h-full gap-0 transition-colors group-hover/tile:bg-accent/50">
                      <CardContent className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                          <entry.icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-center gap-2 truncate text-sm font-medium">
                            {entry.label}
                            <Dot tag={entry.tag} />
                          </span>
                          {title !== entry.label && title !== "Admin" && <span className="truncate text-xs text-muted-foreground">{title}</span>}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
