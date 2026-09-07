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
export function AdminCrumb({ crumbs }: { crumbs: { label: string; page?: string; /** The crumb drawn as something else: a subject switcher. */ node?: React.ReactNode }[] }) {
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
              {crumb.node ? (
                <BreadcrumbPage className="whitespace-nowrap">{crumb.node}</BreadcrumbPage>
              ) : i === last || crumb.page == null ? (
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
