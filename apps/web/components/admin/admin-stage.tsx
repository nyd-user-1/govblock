"use client"

import * as React from "react"

import { AdminTopbar } from "@/components/admin/blocks/layout"
import { menuPath } from "@/components/admin/items"
import { AdminNavProvider } from "@/components/admin/nav"
import { AdminCrumb } from "@/components/admin/page-title"
import { AdminRail } from "@/components/admin/rail"
import { AdminPage, adminTitle } from "@/components/admin/pages"
import { BlockShell } from "@/components/policy/block-shell"

// The Admin experience: paceui's Ultimate Dashboard, rebuilt in our chrome
// and dropped into the block shell (Brendan, 2026-09-05: "Don't materially
// change the container of our dashboard design; the paceui components should
// slot very nicely into it"). The rail is their sidebar, the header's actions
// are their topbar, and the stage is whichever of their pages the URL names.
// Where the record has the shape a page wants — a session's bills for Orders,
// its members for Customers, the feeds behind it for Database — the page reads
// the record; the rest keep paceui's sample rows until they have a home.

// Brendan, 2026-09-06, reading his Data Pipeline redesign back: the page's
// title is the header's breadcrumb, "Admin › Data Pipeline", on every page;
// the rule after the sidebar trigger runs tight; the first block sits flush
// under the header; the footer is the header's twin; and the customizer
// leaves the screen (that part lives in the designer). 2026-09-07: the
// footer is the designer's, set once for every stage's shell.

// A page about one thing carries it as the last crumb, under the rail's word
// for the page: Dashboard › Member › Senator Peter Parker.
const SUBJECT: Record<string, string> = { member: adminTitle("member"), committee: adminTitle("committee") }

export function AdminStage({
  page,
  onGo,
  onHome,
  content,
  railOpen = true,
}: {
  page: string
  onGo: (page: string) => void
  /** The crumb's root, the dashboards menu (2026-09-07). */ onHome?: () => void
  /** What the stage shows in place of the page: the menu, whose crumb is the root alone. */ content?: React.ReactNode
  /** Whether the rail starts open; the workspace opens it closed (Brendan, 2026-09-07). */ railOpen?: boolean
}) {
  const nav = React.useMemo(() => ({ page, go: onGo, home: onHome }), [page, onGo, onHome])
  // The crumb follows the route: the rail's labels down to the page, then the page's subject where it has one (Brendan, 2026-09-07: "get rid of Admin").
  const crumbs = React.useMemo(() => (content ? [] : SUBJECT[page] ? [...menuPath(page), { label: SUBJECT[page] }] : menuPath(page)), [page, content])
  return (
    <AdminNavProvider value={nav}>
      <BlockShell defaultOpen={railOpen} rail={<AdminRail />} sidebarWidth="250px" separatorClassName="mx-1" title={<AdminCrumb crumbs={crumbs} />} actions={<AdminTopbar />}>
        <div className="flex flex-1 flex-col p-4 sm:p-5 [&>div>*:first-child]:mt-0">{content ?? <AdminPage page={page} />}</div>
      </BlockShell>
    </AdminNavProvider>
  )
}
