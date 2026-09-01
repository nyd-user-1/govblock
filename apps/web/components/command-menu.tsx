"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { memberHref, stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { policyUrl } from "@/lib/policy/use-policy"
import { matchPages, SEARCH_PAGES } from "@/lib/search-pages"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@govblock/ui/components/nova/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@govblock/ui/components/nova/dialog"
import { Button } from "@govblock/ui/components/ny4/button"

// The search trigger from livingston-v3 components/command-menu.tsx, with the
// dialog behind it finally wired: ⌘K or a click opens a command menu that
// searches the jurisdiction you are in — bills, members, committees — through
// /api/policy/search, plus the site's own pages. Enter goes to the record;
// "See all results" goes to /search.

type SearchPayload = {
  q: string
  bills: { bill_id: number; bill_number: string; title: string }[]
  members: { people_id: number; name: string; party: string; chamber: string }[]
  committees: { committee: string; bills: number; chamber: string }[]
}

export function CommandMenu() {
  const router = useRouter()
  const { state, session, resolved } = useJurisdiction()
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState("")
  const [results, setResults] = React.useState<SearchPayload | null>(null)

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((previous) => !previous)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const query = term.trim()

  React.useEffect(() => {
    if (!open || !resolved || query.length < 2) {
      setResults(null)
      return
    }
    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const url = policyUrl(
          "search",
          { state, session: session ? String(session) : undefined },
          { q: query, limit: 6 }
        )
        const response = await fetch(url)
        if (!response.ok) throw new Error(String(response.status))
        const data = (await response.json()) as SearchPayload
        if (!cancelled) setResults(data)
      } catch {
        if (!cancelled) setResults(null)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [open, resolved, query, state, session])

  const go = React.useCallback(
    (href: string) => {
      setOpen(false)
      setTerm("")
      router.push(href)
    },
    [router]
  )

  const here = stateName(state) || "this jurisdiction"
  const bills = results?.bills ?? []
  const members = results?.members ?? []
  const committees = results?.committees ?? []
  const pages = query.length >= 2 ? matchPages(query) : SEARCH_PAGES
  const hasRecords = bills.length + members.length + committees.length > 0

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-8 w-full justify-start rounded-lg border-none bg-muted pl-3 text-foreground shadow-none transition-colors hover:bg-muted/50 md:w-48 lg:w-40 xl:w-64 dark:bg-card"
      >
        <span className="hidden xl:inline-flex">Search documentation...</span>
        <span className="inline-flex xl:hidden">Search...</span>
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-0.5 rounded border bg-background px-1.5 font-sans text-[10px] font-medium text-muted-foreground select-none sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search bills, members, committees and pages...</DialogDescription>
        </DialogHeader>
        <DialogContent className="top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0" showCloseButton={false}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${here}...`}
              value={term}
              onValueChange={setTerm}
            />
            <CommandList>
              <CommandEmpty>
                {query.length < 2 ? "Type to search bills, members, committees, pages..." : "Nothing found."}
              </CommandEmpty>
              {bills.length > 0 && (
                <CommandGroup heading={`Bills — ${here}`}>
                  {bills.map((bill) => (
                    <CommandItem
                      key={`bill-${bill.bill_id}`}
                      value={`bill-${bill.bill_id}`}
                      onSelect={() => go(`/docs/bills/${bill.bill_id}?state=${state}`)}
                    >
                      <span className="shrink-0 font-medium">{bill.bill_number}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{bill.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {members.length > 0 && (
                <CommandGroup heading="Members">
                  {members.map((member) => (
                    <CommandItem
                      key={`member-${member.people_id}`}
                      value={`member-${member.people_id}`}
                      onSelect={() => go(memberHref(member.people_id, state))}
                    >
                      <span className="shrink-0 font-medium">{member.name}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {[member.party, member.chamber].filter(Boolean).join(" · ")}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {committees.length > 0 && (
                <CommandGroup heading="Committees">
                  {committees.map((committee) => (
                    <CommandItem
                      key={`committee-${committee.committee}`}
                      value={`committee-${committee.committee}`}
                      onSelect={() =>
                        go(`/docs/bills?state=${state}&committee=${encodeURIComponent(committee.committee)}`)
                      }
                    >
                      <span className="shrink-0 font-medium">{committee.committee}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {committee.bills} bills
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {pages.length > 0 && (
                <CommandGroup heading="Pages">
                  {pages.map((page) => (
                    <CommandItem key={page.href} value={`page-${page.href}`} onSelect={() => go(page.href)}>
                      <span className="shrink-0 font-medium">{page.name}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{page.group}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {query.length >= 2 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value={`see-all-${query}`}
                      onSelect={() => go(`/search?q=${encodeURIComponent(query)}&state=${state}`)}
                    >
                      See all results for &ldquo;{query}&rdquo;
                      {hasRecords ? "" : "..."}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
