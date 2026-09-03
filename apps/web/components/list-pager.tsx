"use client"

import * as React from "react"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"

import { cn } from "@govblock/ui/lib/utils"
import { Button, buttonVariants } from "@govblock/ui/components/nova/button"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@govblock/ui/components/nova/pagination"

// Every list on the site shows fifty and pages the rest (Brendan, 2026-09-03).
// Lifted from the members directory, which was the one list that paged; the
// pager is drawn in exactly one file so the lists cannot page differently.
export const PAGE_SIZE = 50

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE))

function getPageNumbers(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1) as (number | "ellipsis")[]
  const pages: (number | "ellipsis")[] = [1]
  if (current > 4) pages.push("ellipsis")
  else if (current >= 4) pages.push(2)
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i)
  if (current < total - 3) pages.push("ellipsis")
  else if (current <= total - 3) pages.push(total - 1)
  pages.push(total)
  return pages
}

function PageLink({
  className,
  isActive,
  size = "icon",
  ...props
}: React.ComponentProps<"a"> & { isActive?: boolean; size?: React.ComponentProps<typeof Button>["size"] }) {
  return (
    <a aria-current={isActive ? "page" : undefined} data-slot="pagination-link" data-active={isActive} className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), className)} {...props} />
  )
}

export function ListPager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null
  const current = Math.min(Math.max(1, page), pages)
  const go = (event: React.MouseEvent, next: number, disabled = false) => {
    event.preventDefault()
    if (disabled) return
    onPage(next)
    window.scrollTo({ top: 0 })
  }
  return (
    <Pagination className="not-typeset">
      <PaginationContent className="not-typeset list-none p-0 [&>li]:m-0 [&>li]:p-0 [&>li]:before:hidden">
        <PaginationItem>
          <PageLink href="#" aria-label="Go to previous page" size="default" className={cn("pl-1.5!", current <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer")} onClick={(e) => go(e, current - 1, current <= 1)}>
            <IconChevronLeft className="size-4" />
            <span className="hidden sm:block">Previous</span>
          </PageLink>
        </PaginationItem>
        {getPageNumbers(current, pages).map((p, i) =>
          p === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PageLink href="#" isActive={p === current} className="cursor-pointer" onClick={(e) => go(e, p)}>
                {p}
              </PageLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PageLink href="#" aria-label="Go to next page" size="default" className={cn("pr-1.5!", current >= pages ? "pointer-events-none opacity-50" : "cursor-pointer")} onClick={(e) => go(e, current + 1, current >= pages)}>
            <span className="hidden sm:block">Next</span>
            <IconChevronRight className="size-4" />
          </PageLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
