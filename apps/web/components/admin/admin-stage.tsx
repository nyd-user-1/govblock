"use client"

import * as React from "react"

import { stateName } from "@/lib/filters"
import { useScope, useSessionTitle } from "@/lib/policy/scope"
import { AdminTopbar } from "@/components/admin/blocks/layout"
import { AdminNavProvider } from "@/components/admin/nav"
import { AdminFooter } from "@/components/admin/page-title"
import { AdminRail } from "@/components/admin/rail"
import { AdminPage } from "@/components/admin/pages"
import { BlockShell } from "@/components/policy/block-shell"
import { Badge } from "@govblock/ui/components/nova/badge"

// The Admin experience: paceui's Ultimate Dashboard, rebuilt in our chrome
// and dropped into the block shell (Brendan, 2026-09-05: "Don't materially
// change the container of our dashboard design; the paceui components should
// slot very nicely into it"). The rail is their sidebar, the header's actions
// are their topbar, and the stage is whichever of their pages the URL names.
// Where the record has the shape a page wants — a session's bills for Orders,
// its members for Customers, the feeds behind it for Database — the page reads
// the record; the rest keep paceui's sample rows until they have a home.

export function AdminStage({ page, onGo }: { page: string; onGo: (page: string) => void }) {
  const scope = useScope()
  const sessionTitle = useSessionTitle(scope.state, scope.session)
  const nav = React.useMemo(() => ({ page, go: onGo }), [page, onGo])
  return (
    <AdminNavProvider value={nav}>
      <BlockShell
        rail={<AdminRail />}
        sidebarWidth="250px"
        title={
          <>
            <span>Admin — {stateName(scope.state)}</span>
            <Badge variant="outline" className="hidden font-normal sm:inline-flex">
              {sessionTitle || "…"}
            </Badge>
          </>
        }
        actions={<AdminTopbar />}
      >
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <AdminPage page={page} />
        </div>
        <div className="mb-3 px-6">
          <AdminFooter />
        </div>
      </BlockShell>
    </AdminNavProvider>
  )
}
