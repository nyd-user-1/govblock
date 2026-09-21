"use client"

import * as React from "react"
import { LoadingFlag } from "@/components/loading-flag"
import { LibraryIcon } from "lucide-react"

import type { AtItem, AtResponse } from "@/app/api/typeset/at/route"
import type { SlashItem, SlashResponse } from "@/app/api/typeset/slash/route"
import { ChamberSeal, FlagChip, PartyDot } from "@/components/policy/imagery"
import { CommandEmpty, CommandGroup, CommandItem } from "@govblock/ui/components/nova/command"

// The `/` command in the search menu, stubbed (window 1, 2026-09-14): a
// query that starts with "/" is read as an address in the corpus
// (docs/xml/schema.md) rather than searched for, and the menu lists the
// Works under it. "@" is the citation resolver's, window 4's: the seam is
// `corpusMode`, which already routes it here with nothing to list yet.

export type CorpusMode = "slash" | "at" | null

export const corpusMode = (term: string): CorpusMode => (term.startsWith("/") ? "slash" : term.startsWith("@") ? "at" : null)

/** `within` narrows either lookup to one jurisdiction: the search's `/809 /nj` and `@martinez /ny`. */
export function useSlashLibrary(term: string, active: boolean, within?: string | null) {
  const [result, setResult] = React.useState<SlashResponse | null>(null)
  const [at, setAt] = React.useState<AtResponse | null>(null)
  const [pending, setPending] = React.useState(false)
  const mode = corpusMode(term)
  React.useEffect(() => {
    if (!active || !mode || term.length < (mode === "at" ? 3 : 2)) {
      setResult(null)
      setAt(null)
      return
    }
    let cancelled = false
    setPending(true)
    const handle = setTimeout(async () => {
      try {
        // "@" is references (window 6): citations, members and committees in one palette.
        const narrow = within ? `&in=${within}` : ""
        const response = await fetch(mode === "at" ? `/api/typeset/at?q=${encodeURIComponent(term)}${narrow}` : `/api/typeset/slash?q=${encodeURIComponent(term)}${narrow}`)
        const body = await response.json()
        if (cancelled) return
        if (mode === "at") setAt(body as AtResponse)
        else setResult(body as SlashResponse)
      } catch {
        if (!cancelled) {
          setResult(null)
          setAt(null)
        }
      } finally {
        if (!cancelled) setPending(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [active, mode, term, within])
  return { mode, result, at, pending }
}

function AtGroup({ heading, items, go }: { heading: string; items: AtItem[]; go: (href: string) => void }) {
  if (!items.length) return null
  return (
    <CommandGroup heading={heading}>
      {items.map((item) => (
        <CommandItem key={`${item.kind}-${item.label}-${item.href}`} className="group/row" value={`at-${item.kind}-${item.label}-${item.href}`} disabled={!item.href} onSelect={() => item.href && go(item.href)}>
          {item.state ? <FlagChip state={item.state} width={20} /> : <LibraryIcon className="text-muted-foreground" />}
          <span className={LABEL}>{item.label}</span>
          {/* A member's body wears its chamber's seal, and the party is a dot, red or blue, where the letter was (Brendan, 2026-09-21). */}
          <span className="flex min-w-0 flex-1 items-center gap-2 truncate pl-2 text-left text-muted-foreground transition-colors group-data-[selected=true]/row:text-foreground">
            {item.kind === "member" && item.state && item.chamber && <ChamberSeal state={item.state} chamber={item.chamber} size={18} />}
            <span className="truncate">{item.detail}</span>
            {item.kind === "member" && item.party && <PartyDot party={item.party} />}
          </span>
          {item.kind === "citation" && item.insert.href && <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground md:inline">{item.insert.href}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

const LABEL = "w-48 shrink-0 truncate font-medium"

export function SlashResults({ mode, result, at, pending, term, go }: { mode: CorpusMode; result: SlashResponse | null; at?: AtResponse | null; pending: boolean; term: string; go: (href: string) => void }) {
  if (mode === "at") {
    if (term.length < 3) return <CommandEmpty>@10 U.S.C. 130i, @section 16 of the agriculture and markets law, or a member or committee by name</CommandEmpty>
    if (!at || !(at.citations.length || at.members.length || at.committees.length)) return <CommandEmpty>{pending ? <LoadingFlag width={28} /> : "Nothing by that reference."}</CommandEmpty>
    return (
      <>
        <AtGroup heading="Citations" items={at.citations} go={go} />
        <AtGroup heading="Members" items={at.members} go={go} />
        <AtGroup heading="Committees" items={at.committees} go={go} />
      </>
    )
  }
  if (term.length < 2) return <CommandEmpty>/119, /6644, /hr6644, /new-york-code, or an address like /us/bill/119/hr/6644</CommandEmpty>
  if (!result) return <CommandEmpty>{pending ? <LoadingFlag width={28} /> : "Nothing at that address."}</CommandEmpty>
  if (!result.items.length && !result.href) return <CommandEmpty>{pending ? <LoadingFlag width={28} /> : `Nothing under ${result.label || term}.`}</CommandEmpty>
  return (
    <CommandGroup heading={result.label}>
      {/* Where the query lives (window 4): the library, or the Work in the XML view. Enter opens it. */}
      {result.href && (
        <CommandItem className="group/row" value={`slash-open-${result.href}`} onSelect={() => go(result.href!)}>
          <LibraryIcon className="text-muted-foreground" />
          <span className={LABEL}>{result.label}</span>
          <span className="min-w-0 flex-1 truncate pl-2 text-left text-muted-foreground">{result.href}</span>
        </CommandItem>
      )}
      {result.items.map((item: SlashItem) => (
        <CommandItem key={`${item.address}-${item.href}`} className="group/row" value={`slash-${item.href ?? item.address}`} onSelect={() => item.href && go(item.href)}>
          {item.state ? <FlagChip state={item.state} width={20} /> : <LibraryIcon className="text-muted-foreground" />}
          <span className={LABEL}>{item.label}</span>
          <span className="min-w-0 flex-1 truncate pl-2 text-left text-muted-foreground transition-colors group-data-[selected=true]/row:text-foreground">{item.description}</span>
          {item.address && <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground md:inline">{item.address}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
