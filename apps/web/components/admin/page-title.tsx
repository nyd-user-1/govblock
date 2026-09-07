"use client"

import * as React from "react"

import { useAdminNav } from "@/components/admin/nav"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@govblock/ui/components/nova/breadcrumb"

// paceui's PageTitle put the page's name on the left and "Admin › …" on the
// right. Since 2026-09-06 the name lives in the shell header's breadcrumb
// (AdminCrumb, below), so a page's title row is only whatever controls it
// carried on the right — a select, a status, a button — and nothing when it
// carried none.

export function PageTitle({ endContent }: { title: string; endContent?: React.ReactNode; links?: { label: string; page: string }[] }) {
  if (!endContent) return null
  return <div className="flex items-center justify-end">{endContent}</div>
}

/** The shell header's title: Admin › the page, with the parent between where a page has one. */
export function AdminCrumb({ title, links }: { title: string; links?: { label: string; page: string }[] }) {
  const { go } = useAdminNav()
  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink render={<button type="button" onClick={() => go("")} />}>Admin</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {links?.map((link) => (
          <React.Fragment key={link.page}>
            <BreadcrumbItem>
              <BreadcrumbLink render={<button type="button" onClick={() => go(link.page)} />}>{link.label}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </React.Fragment>
        ))}
        <BreadcrumbItem>
          <BreadcrumbPage className="whitespace-nowrap">{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/** The footer is the header's twin (Brendan, 2026-09-06): the same bar, GovBlocks on the left, the docs on the right, a rule above. */
export function AdminFooter() {
  const { go } = useAdminNav()
  return (
    <footer className="relative z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-t">
      <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
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
      </div>
    </footer>
  )
}
