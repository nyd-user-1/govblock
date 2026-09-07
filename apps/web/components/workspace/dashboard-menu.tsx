"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LayoutDashboardIcon, type LucideIcon } from "lucide-react"

import { ADMIN_MENU, type MenuItem } from "@/components/admin/items"
import { adminTitle } from "@/components/admin/pages"
import { WorkspaceGrid, type GridItem } from "@/components/workspace/grid"
import { DashboardSketch, type SketchSpec } from "@/components/workspace/dashboard-sketch"
import { dashboardHref } from "@/lib/workspace/dashboard"
import { useUrlSearch } from "@/lib/policy/url-state"
import { Card, CardContent } from "@govblock/ui/components/nova/card"
import { DropdownMenuItem } from "@govblock/ui/components/dropdown-menu"

// /workspace/dashboard itself: the menu of every dashboard (Brendan,
// 2026-09-07). The Dashboards section is Cloudflare's dashboards menu inside
// our cards: on the standard workspace grid, each card a rough sketch of
// the dashboard — its stat tiles and its charts — then the name (Brendan,
// 2026-09-07: no chart count, no created and updated lines). The other sections
// (Apps, Page, Components, Other) are one small card per page, as they were.

type Entry = { label: string; page: string; icon: LucideIcon; tag?: MenuItem["tag"] }
type Section = { label: string; entries: Entry[] }

/** Each dashboard's sketch: the tiles and panels as the page draws them. */
const DASHBOARDS: Record<string, { spec: SketchSpec }> = {
  "": { spec: { tiles: ["#", "#", "#", "#"], panels: ["bars", "list"] } },
  logs: { spec: { tiles: ["#", "#", "#", "%", "#"], panels: ["area", "list"] } },
  customers: { spec: { tiles: ["#", "#", "%"], panels: ["line", "bars"] } },
  orders: { spec: { tiles: ["#", "#", "%", "#"], panels: ["bars", "line"] } },
  traffic: { spec: { tiles: ["#", "#", "%", "#"], panels: ["area"] } },
  education: { spec: { tiles: ["#", "#", "%"], panels: ["bars", "list"] } },
  committee: { spec: { tiles: ["#", "#", "%"], panels: ["bars", "bars", "bars"] } },
  crypto: { spec: { tiles: ["#", "#", "#"], panels: ["line", "list"] } },
  database: { spec: { tiles: ["#", "#", "#", "#"], panels: ["bars", "area"] } },
  skeleton: { spec: { tiles: ["#", "#", "#"], panels: ["list"] } },
}

const LAYOUT_KEY = "govblock:workspace:dashboard:layout"

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
        const record = DASHBOARDS[entry.page] ?? { spec: { tiles: ["#", "#", "#"], panels: ["line"] as SketchSpec["panels"] } }
        const href = dashboardHref(entry.page, search)
        const explore = () => router.push(href)
        const share = () => navigator.clipboard?.writeText(`${window.location.origin}${href}`).catch(() => {})
        return {
          key: `dashboard-${entry.page || "session"}`,
          group: "dashboards",
          badge: <Dot tag={entry.tag} />,
          media: <DashboardSketch spec={record.spec} />,
          title: adminTitle(entry.page),
          // No buttons (Brendan, 2026-09-07): the card itself opens the dashboard.
          onOpen: explore,
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
  const groups = React.useMemo(() => sections(), [])
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
