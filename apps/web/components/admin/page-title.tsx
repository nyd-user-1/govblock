"use client"

import * as React from "react"

import { useAdminNav } from "@/components/admin/nav"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@govblock/ui/components/nova/breadcrumb"

// paceui's PageTitle: the page's name on the left, "Admin › …" on the right.

export function PageTitle({ title, endContent, links }: { title: string; endContent?: React.ReactNode; links?: { label: string; page: string }[] }) {
  const { go } = useAdminNav()
  return (
    <div className="flex items-center justify-between">
      <p className="text-lg font-medium sm:text-xl">{title}</p>
      {endContent || (
        <Breadcrumb className="max-sm:hidden">
          <BreadcrumbList>
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
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}
    </div>
  )
}

export function AdminFooter() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-sm:text-center max-sm:text-sm">
        Built by{" "}
        <a className="font-medium hover:text-primary hover:underline" href="https://x.com/withden_" target="_blank" rel="noreferrer">
          Denish
        </a>{" "}
        at{" "}
        <a className="font-medium hover:text-primary hover:underline" href="https://paceui.com" target="_blank" rel="noreferrer">
          PaceUI
        </a>
        , in GovBlock's chrome
      </p>
      <div className="flex items-center gap-4 text-sm">
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
  )
}
