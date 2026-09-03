"use client"

import * as React from "react"
import Link from "next/link"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"

import members from "@/lib/data/members-us.json"
import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { memberHref, partyName, stateName } from "@/lib/filters"
import { honorific } from "@/lib/format"
import { portraitFor } from "@/lib/imagery"
import { SearchDirectory } from "@/components/directory-search"
import { MemberPortrait } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { cn } from "@govblock/ui/lib/utils"
import { Button, buttonVariants } from "@govblock/ui/components/nova/button"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@govblock/ui/components/nova/pagination"

// Ported from livingston-v3 components/directory-list.tsx: every sitting
// member, twenty to a page, searchable by name, district or party. Each row is
// the canon item (Brendan, 2026-09-02 20:30 ET): portrait, name, the
// leadership title beside it, chamber · district · party beneath. The whole
// row is the link to the member page, which is where the record lives — the
// Record button that opened an unwired dialog of zeros is gone with it.

const PAGE_SIZE = 20
type Member = (typeof members)[number]

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

const matches = (m: Member, q: string) =>
  m.name.toLowerCase().includes(q) || (m.district ?? "").toLowerCase().includes(q) || partyName(m.party).toLowerCase().includes(q) || (m.chamber ?? "").toLowerCase().includes(q)

export function DirectoryList() {
  const { data, state, resolved } = useScoped<Member[]>("members", members)
  const [query, setQuery] = React.useState("")
  const [page, setPage] = React.useState(1)

  // The page is "every sitting member": the roster is who sits this session.
  // Former members come back too — they sponsored the bills the rest of the app
  // links to — but they do not belong in a directory of the current chamber.
  const sitting = React.useMemo(() => (data ?? []).filter((m) => m.active), [data])

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? sitting.filter((m) => matches(m, q)) : sitting
  }, [sitting, query])
  React.useEffect(() => setPage(1), [state])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const go = (event: React.MouseEvent, next: number, disabled = false) => {
    event.preventDefault()
    if (disabled) return
    setPage(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <>
      <SearchDirectory
        query={query}
        registriesCount={rows.length}
        setQuery={(value) => {
          setQuery(value ?? "")
          setPage(1)
        }}
        placeholder={resolved ? `Search ${stateName(state)} members by name, district or party…` : "Search members by name, district or party…"}
      />
      <RecordList className="my-8">
        {shown.map((member) => (
          <RecordItem
            key={member.people_id}
            href={memberHref(member.people_id, state)}
            avatar={<MemberPortrait name={member.name} photoUrl={portraitFor(member)} state={state} chamber={member.chamber} size={36} />}
            title={`${honorific(member.role, member.chamber)} ${member.name}`.trim()}
            lead={member.leadership_title}
            meta={[member.chamber, member.district ? member.district.replace(/^[A-Z]+-0*/, "District ") : null, partyName(member.party)]}
          />
        ))}
        {!shown.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No members for {stateName(state)}
            {query ? ` matching “${query}”` : ""}.
          </p>
        )}
      </RecordList>
      {totalPages > 1 && (
        <Pagination className="not-typeset">
          <PaginationContent className="not-typeset list-none p-0 [&>li]:m-0 [&>li]:p-0 [&>li]:before:hidden">
            <PaginationItem>
              <PageLink href="#" aria-label="Go to previous page" size="default" className={cn("pl-1.5!", current <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer")} onClick={(e) => go(e, current - 1, current <= 1)}>
                <IconChevronLeft className="size-4" />
                <span className="hidden sm:block">Previous</span>
              </PageLink>
            </PaginationItem>
            {getPageNumbers(current, totalPages).map((p, i) =>
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
              <PageLink href="#" aria-label="Go to next page" size="default" className={cn("pr-1.5!", current >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer")} onClick={(e) => go(e, current + 1, current >= totalPages)}>
                <span className="hidden sm:block">Next</span>
                <IconChevronRight className="size-4" />
              </PageLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </>
  )
}
