"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { History } from "lucide-react"

import { memberHref } from "@/lib/filters"
import { FlagChip } from "@/components/policy/imagery"
import { useRecents } from "@/components/home/recents"
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
import { fmtBill } from "@/lib/format"

// The search trigger from livingston-v3 components/command-menu.tsx, with the
// dialog behind it finally wired: ⌘K or a click opens a command menu that
// searches the jurisdiction you are in — bills, members, committees — through
// /api/policy/search, plus the site's own pages. Enter goes to the record;
// "See all results" goes to /search.
//
// The search itself — the fetch, the selection, the groups — is the hook and
// the list below, so the account home's bar can drop the same results from
// itself (Brendan, 2026-09-07) instead of opening this dialog.

type SearchPayload = {
  q: string
  bills: { bill_id: number; bill_number: string; title: string; state?: string }[]
  members: { people_id: number; name: string; party: string; chamber: string; state: string; active: boolean }[]
  committees: { committee: string; bills: number; chamber: string; state?: string }[]
}

export type SiteSearch = {
  query: string
  bills: SearchPayload["bills"]
  members: SearchPayload["members"]
  committees: SearchPayload["committees"]
  pages: typeof SEARCH_PAGES
  hasRecords: boolean
  selected: string
  setSelected: (value: string) => void
}

/**
 * The site search over the jurisdiction in scope, while `active`. `lead` is
 * the item to select before a word is typed, when the caller has one to put
 * above the pages (the home's recents).
 */
export function useSiteSearch({ active, term, lead }: { active: boolean; term: string; lead?: string }): SiteSearch {
  const { state, session, resolved } = useJurisdiction()
  const [results, setResults] = React.useState<SearchPayload | null>(null)
  const [selected, setSelected] = React.useState("")
  const query = term.trim()

  React.useEffect(() => {
    if (!active || !resolved || query.length < 2) {
      setResults(null)
      return
    }
    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const url = policyUrl(
          "search",
          { state, session: session ? String(session) : undefined },
          { q: query, limit: 6, all: 1 }
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
  }, [active, resolved, query, state, session])

  // cmdk keeps whatever was selected when the list changes underneath it, and
  // between keystroke and response the only stable item is "See all results" —
  // so the selection is controlled, and snaps to the top result every time the
  // query or its results change.
  React.useEffect(() => {
    const b = results?.bills?.[0]
    const m = results?.members?.[0]
    const c = results?.committees?.[0]
    const p = (query.length >= 2 ? matchPages(query) : SEARCH_PAGES)[0]
    setSelected(
      b ? `bill-${b.bill_id}`
        : m ? `member-${m.people_id}`
        : c ? `committee-${c.committee}`
        : query.length < 2 && lead ? lead
        : p ? `page-${p.href}`
        : query.length >= 2 ? `see-all-${query}`
        : ""
    )
  }, [query, results, lead])

  const bills = results?.bills ?? []
  const members = results?.members ?? []
  const committees = results?.committees ?? []
  const pages = query.length >= 2 ? matchPages(query) : SEARCH_PAGES
  return { query, bills, members, committees, pages, hasRecords: bills.length + members.length + committees.length > 0, selected, setSelected }
}

/** The result groups, inside a CommandList: records first, then pages, then the way to every result. */
export function SearchResults({ search, state, go }: { search: SiteSearch; state: string; go: (href: string) => void }) {
  const { query, bills, members, committees, pages, hasRecords } = search
  return (
    <>
      <CommandEmpty>
        {query.length < 2 ? "Type to search bills, members, committees, pages..." : "Nothing found."}
      </CommandEmpty>
      {bills.length > 0 && (
        <CommandGroup heading="Bills">
          {bills.map((bill) => (
            <CommandItem
              key={`bill-${bill.bill_id}`}
              value={`bill-${bill.bill_id}`}
              onSelect={() => go(`/docs/bills/${bill.bill_id}?state=${bill.state ?? state}`)}
            >
              <FlagChip state={bill.state ?? state} width={20} />
              <span className="shrink-0 font-medium">{fmtBill(bill.bill_number, bill.state ?? state)}</span>
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
              onSelect={() => go(memberHref(member.people_id, member.state))}
            >
              <FlagChip state={member.state} width={20} />
              <span className="shrink-0 font-medium">
                {member.name}
                {member.active ? "" : " (Ret.)"}
              </span>
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
                go(`/docs/bills?state=${committee.state ?? state}&committee=${encodeURIComponent(committee.committee)}`)
              }
            >
              <FlagChip state={committee.state ?? state} width={20} />
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
    </>
  )
}

export function CommandMenu() {
  const router = useRouter()
  const { state } = useJurisdiction()
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState("")
  const recents = useRecents(5)
  const lead = recents[0] ? `recent-${recents[0].href}` : undefined
  const search = useSiteSearch({ active: open, term, lead })
  const showRecents = search.query.length < 2 && recents.length > 0

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

  const go = React.useCallback(
    (href: string) => {
      setOpen(false)
      setTerm("")
      router.push(href)
    },
    [router]
  )

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
          <Command shouldFilter={false} value={search.selected} onValueChange={search.setSelected}>
            <CommandInput
              placeholder="Search"
              value={term}
              onValueChange={setTerm}
            />
            <CommandList>
              {showRecents && (
                <CommandGroup heading="Recents">
                  {recents.map((recent) => (
                    <CommandItem key={recent.href} value={`recent-${recent.href}`} onSelect={() => go(recent.href)}>
                      <History className="text-muted-foreground" />
                      <span className="shrink-0 font-medium">{recent.title}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{recent.group}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <SearchResults search={search} state={state} go={go} />
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
