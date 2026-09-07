"use client"

import * as React from "react"

import { useAdminNav } from "@/components/admin/nav"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@govblock/ui/components/nova/breadcrumb"

// paceui's PageTitle put the page's name on the left and "Admin › …" on the
// right. Since 2026-09-06 the name lives in the shell header's breadcrumb
// (AdminCrumb, below), so a page's title row is only whatever controls it
// carried on the right — a select, a status, a button — and nothing when it
// carried none.

export function PageTitle({ endContent }: { title: string; endContent?: React.ReactNode }) {
  if (!endContent) return null
  return <div className="flex items-center justify-end">{endContent}</div>
}

/** The shell header's title, following the route (Brendan, 2026-09-07): Dashboard, then the rail's labels down to the page — Dashboard › Session, Dashboard › Roll Call, Dashboard › Users › Create — and a page's subject last where it has one, Dashboard › Member › Senator Peter Parker. A crumb with a page of its own is a link; the root opens the dashboards menu. */
export function AdminCrumb({ crumbs }: { crumbs: { label: string; page?: string }[] }) {
  const { go, home } = useAdminNav()
  const last = crumbs.length - 1
  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          {last < 0 ? <BreadcrumbPage className="whitespace-nowrap">Dashboard</BreadcrumbPage> : <BreadcrumbLink render={<button type="button" onClick={() => (home ? home() : go(""))} />}>Dashboard</BreadcrumbLink>}
        </BreadcrumbItem>
        {crumbs.map((crumb, i) => (
          <React.Fragment key={`${i}-${crumb.label}`}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {i === last || crumb.page == null ? (
                <BreadcrumbPage className="whitespace-nowrap">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<button type="button" onClick={() => go(crumb.page!)} />} className="whitespace-nowrap">
                  {crumb.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/** The footer is the header's twin (Brendan, 2026-09-06): GovBlocks on the left, the docs on the right. Since 2026-09-07 it is the shell's footer, below the card, so this is only the bar's contents. */
export function AdminFooter() {
  const { go } = useAdminNav()
  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2 text-base font-medium">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<button type="button" onClick={() => go("")} />}>GovBlocks</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-4 text-sm">
        <a href="/docs" className="not-hover:text-muted-foreground">
          About
        </a>
        <a href="/docs/api" className="not-hover:text-muted-foreground">
          API
        </a>
        <a href="/docs/datasets" className="not-hover:text-muted-foreground">
          Datasets
        </a>
      </div>
    </>
  )
}
