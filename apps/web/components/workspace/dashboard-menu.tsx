"use client"

import * as React from "react"
import Link from "next/link"
import { LayoutDashboardIcon, type LucideIcon } from "lucide-react"

import { ADMIN_MENU, type MenuItem } from "@/components/admin/items"
import { adminTitle } from "@/components/admin/pages"
import { dashboardHref } from "@/lib/workspace/dashboard"
import { useUrlSearch } from "@/lib/policy/url-state"
import { Card, CardContent } from "@govblock/ui/components/nova/card"

// /workspace/dashboard itself: the menu of every dashboard (Brendan,
// 2026-09-07), in the rail's own sections — Dashboards, Apps, Page,
// Components, Other — one card per page, nested entries flattened under
// their parent's name. A card is the rail's label, the page's own title
// beneath it where the two differ, and the rail's dot.

type Entry = { label: string; page: string; icon: LucideIcon; tag?: MenuItem["tag"] }
type Section = { label: string; entries: Entry[] }

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

export function DashboardMenu() {
  const search = useUrlSearch()
  const groups = React.useMemo(sections, [])
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.label} className="flex flex-col gap-3">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-foreground/60 uppercase">{group.label}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {group.entries.map((entry) => {
              const title = adminTitle(entry.page)
              return (
                <Link key={entry.page} href={dashboardHref(entry.page, typeof search === "string" ? search : "")} className="group/tile rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
        </section>
      ))}
    </div>
  )
}
