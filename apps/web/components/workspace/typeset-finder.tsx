"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronsUpDown, FileTextIcon, FolderIcon, LandmarkIcon, UserIcon, XIcon } from "lucide-react"

import { fmtBill } from "@/lib/format"
import { usePolicy } from "@/lib/policy/use-policy"
import { useScope } from "@/lib/policy/scope"
import { useMyForks } from "@/lib/policy/forks"
import type { BillRow, Committee, MemberRow } from "@/lib/policy/types"
import { typesetHref } from "@/lib/typeset/views"
import { Button } from "@govblock/ui/components/nova/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@govblock/ui/components/nova/command"
import { Popover, PopoverContent, PopoverTrigger } from "@govblock/ui/components/ny4/popover"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarInput, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"

// The finder (Brendan, 2026-09-15): a combobox in the footer beside the
// workspace switcher, where the view numbers stood. Type a bill, a member or
// a committee; a bill opens in Typeset, a member or a committee opens the
// left rail with their bills, and My Files opens the rail with the reader's
// own drafts. Nothing is read until the box opens.

export type FinderPick = { kind: "member"; id: number; label: string } | { kind: "committee"; id: string; label: string } | { kind: "files" }

type FinderState = { pick: FinderPick | null; setPick: (pick: FinderPick | null) => void }
const Ctx = React.createContext<FinderState>({ pick: null, setPick: () => {} })

export function TypesetFinderProvider({ children }: { children: React.ReactNode }) {
  const [pick, setPick] = React.useState<FinderPick | null>(null)
  const value = React.useMemo(() => ({ pick, setPick }), [pick])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useFinder = () => React.useContext(Ctx)

const includes = (hay: string | null | undefined, needle: string) => (hay ?? "").toLowerCase().includes(needle)

/** The footer's combobox. */
export function FinderSwitch() {
  const router = useRouter()
  const scope = useScope()
  const { pick, setPick } = useFinder()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const q = query.trim().toLowerCase()
  const filters = { state: scope.state || "US", session: scope.session ? String(scope.session) : undefined }
  // Read only once the box is open: the lists are the price of a click, not of a page.
  const { data: members } = usePolicy<MemberRow[]>(open ? "members" : null, filters)
  const { data: committees } = usePolicy<Committee[]>(open ? "committees" : null, filters)
  const { data: found } = usePolicy<{ bills?: BillRow[] }>(open && q.length >= 2 ? "search" : null, filters, { q, limit: 8 })
  const memberRows = (members ?? []).filter((m) => !q || includes(m.name, q)).slice(0, 6)
  const committeeRows = (committees ?? []).filter((c) => !q || includes(c.committee_name, q)).slice(0, 6)
  const billRows = found?.bills ?? []
  const label = pick ? (pick.kind === "files" ? "My Files" : pick.label) : "Find"
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 max-w-56 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent"
          aria-label="Find a bill, a member or a committee"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-96 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="A bill, a member, a committee…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{q.length < 2 ? "Type to find, or open My Files." : "Nothing by that name."}</CommandEmpty>
            <CommandGroup heading="Yours">
              <CommandItem
                value="my-files"
                onSelect={() => {
                  setPick({ kind: "files" })
                  setOpen(false)
                }}
              >
                <FolderIcon className="size-4 text-muted-foreground" /> My Files
              </CommandItem>
            </CommandGroup>
            {billRows.length > 0 && (
              <CommandGroup heading="Bills">
                {billRows.map((b) => (
                  <CommandItem
                    key={b.bill_id}
                    value={`bill-${b.bill_id}`}
                    onSelect={() => {
                      setOpen(false)
                      router.push(typesetHref(b.bill_id))
                    }}
                  >
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    <span className="font-medium">{fmtBill(b.bill_number, filters.state)}</span>
                    <span className="truncate text-muted-foreground">{b.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {memberRows.length > 0 && (
              <CommandGroup heading="Members">
                {memberRows.map((m) => (
                  <CommandItem
                    key={m.people_id}
                    value={`member-${m.people_id}`}
                    onSelect={() => {
                      setPick({ kind: "member", id: m.people_id, label: m.name })
                      setOpen(false)
                    }}
                  >
                    <UserIcon className="size-4 text-muted-foreground" />
                    <span className="truncate">{m.name}</span>
                    {m.party && <span className="ml-auto text-xs text-muted-foreground">{m.party}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {committeeRows.length > 0 && (
              <CommandGroup heading="Committees">
                {committeeRows.map((c) => (
                  <CommandItem
                    key={c.slug ?? c.committee_name}
                    value={`committee-${c.slug ?? c.committee_name}`}
                    onSelect={() => {
                      setPick({ kind: "committee", id: String(c.committee_id ?? c.slug ?? c.committee_name), label: c.committee_name })
                      setOpen(false)
                    }}
                  >
                    <LandmarkIcon className="size-4 text-muted-foreground" />
                    <span className="truncate">{c.committee_name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{c.chamber}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** The left rail while a pick is open: the member's or committee's bills, or the reader's drafts, each a door into Typeset. */
export function FinderRail() {
  const router = useRouter()
  const scope = useScope()
  const { pick, setPick } = useFinder()
  const [query, setQuery] = React.useState("")
  const q = query.trim().toLowerCase()
  const state = scope.state || "US"
  const filters = { state, session: scope.session ? String(scope.session) : undefined }
  const byMember = pick?.kind === "member" ? { ...filters, member: String(pick.id) } : null
  const byCommittee = pick?.kind === "committee" ? { ...filters, committee: pick.id } : null
  const { data: bills } = usePolicy<{ rows: BillRow[] }>(byMember || byCommittee ? "bills" : null, byMember ?? byCommittee ?? {}, { limit: 100 })
  // "Not now" (a negative id) unless My Files is the pick: nothing reads on a member's or a committee's rail.
  const { forks } = useMyForks(pick?.kind === "files" ? undefined : -1)
  if (!pick) return null
  const rows = (bills?.rows ?? []).filter((b) => !q || includes(b.bill_number, q) || includes(b.title, q))
  const drafts = (forks ?? []).filter((f) => !q || includes(f.title, q) || includes(f.bill_number, q))
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center justify-between pr-1">
          <span className="truncate">{pick.kind === "files" ? "My Files" : pick.label}</span>
          <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={() => setPick(null)}>
            <XIcon className="size-3.5" />
          </Button>
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarInput placeholder="Find in this list…" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2" />
          <SidebarMenu>
            {pick.kind === "files"
              ? drafts.map((f) => (
                  <SidebarMenuItem key={f.id}>
                    <SidebarMenuButton onClick={() => router.push(`/workspace/typeset/fork/${f.id}`)}>
                      <FileTextIcon />
                      <span className="flex-1 truncate">{f.title ?? f.bill_number ?? `Draft ${f.id}`}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              : rows.map((b) => (
                  <SidebarMenuItem key={b.bill_id}>
                    <SidebarMenuButton onClick={() => router.push(typesetHref(b.bill_id))} title={b.title}>
                      <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">{fmtBill(b.bill_number, state)}</span>
                      <span className="flex-1 truncate">{b.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            {pick.kind !== "files" && bills && rows.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No bills on file.</p>}
            {pick.kind === "files" && drafts.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">Nothing in My Files yet. Start typing on any bill and it lands here.</p>}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
