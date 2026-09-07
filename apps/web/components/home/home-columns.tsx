"use client"

import * as React from "react"
import Link from "next/link"
import { Bot, ChevronRight, Globe, History, MoreHorizontal } from "lucide-react"

import { AGENTS } from "@/lib/agents/registry"
import { stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { useScoped } from "@/lib/policy/use-scoped"
import { useRecents } from "@/components/home/recents"

// The three columns under the search, as Cloudflare's account home has them
// (Brendan, 2026-09-07): the jurisdiction's chambers where it has Domains,
// our agents where it has Workers, and the pages opened last as Recents.
// Every row is a link with a chevron, ruled from the next.

function Column({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex h-8 items-center gap-1 text-sm text-muted-foreground">
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1 no-underline hover:text-foreground">
            {title} <ChevronRight className="size-3.5" />
          </Link>
        ) : (
          <span>{title}</span>
        )}
        <MoreHorizontal className="ml-auto size-4" />
      </div>
      <ul className="m-0 mt-2 list-none divide-y p-0">{children}</ul>
    </div>
  )
}

function Row({ href, icon, children, muted }: { href: string; icon: React.ReactNode; children: React.ReactNode; muted?: React.ReactNode }) {
  return (
    <li className="m-0 p-0">
      <Link href={href} className="group/row flex h-[66px] items-center gap-3 text-[15px] font-medium text-foreground no-underline">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1 truncate">
          {muted && <span className="font-normal text-muted-foreground">{muted} / </span>}
          {children}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5" />
      </Link>
    </li>
  )
}

type Chamber = { chamber: string; seats: number }

export function HomeColumns() {
  const { state } = useJurisdiction()
  const { data: seats } = useScoped<{ chamber: string; party: string; seats: number }[]>("seats", [])
  const recents = useRecents(5)
  const scope = `?state=${state}`
  // The jurisdiction's chambers, from the seats the record holds; Congress
  // stands beside a state so the two legislatures a reader watches are one click each.
  const chambers = React.useMemo(() => {
    const seen = new Map<string, Chamber>()
    for (const row of seats ?? []) seen.set(row.chamber, { chamber: row.chamber, seats: (seen.get(row.chamber)?.seats ?? 0) + row.seats })
    return [...seen.values()].sort((a, b) => a.chamber.localeCompare(b.chamber))
  }, [seats])
  const where = state === "US" ? "U.S." : stateName(state)
  const rows = [
    ...chambers.map((c) => ({ key: `${state}-${c.chamber}`, label: `${where} ${c.chamber}`, href: `/docs/bills${scope}&chamber=${encodeURIComponent(c.chamber)}` })),
    ...(state !== "US"
      ? [
          { key: "US-House", label: "U.S. House", href: "/docs/bills?state=US&chamber=House" },
          { key: "US-Senate", label: "U.S. Senate", href: "/docs/bills?state=US&chamber=Senate" },
        ]
      : []),
  ]

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <Column title="Jurisdictions" href={`/docs/bills${scope}`}>
        {rows.map((r) => (
          <Row key={r.key} href={r.href} icon={<Globe className="size-4" />}>
            {r.label}
          </Row>
        ))}
      </Column>
      <Column title="Agents" href="/agents">
        {AGENTS.map((a) => (
          <Row key={a.slug} href={`/agents/${a.slug}`} icon={<Bot className="size-4" />}>
            {a.name}
          </Row>
        ))}
      </Column>
      <Column title="Recents">
        {recents.length ? (
          recents.map((r) => (
            <Row key={r.href} href={r.href} icon={<History className="size-4" />} muted={r.group}>
              {r.title}
            </Row>
          ))
        ) : (
          <li className="m-0 p-0 py-4 text-sm text-muted-foreground">The pages you open will collect here.</li>
        )}
      </Column>
    </div>
  )
}
