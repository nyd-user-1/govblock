"use client"

import * as React from "react"
import { LibraryIcon } from "lucide-react"

import type { SlashItem, SlashResponse } from "@/app/api/typeset/slash/route"
import { FlagChip } from "@/components/policy/imagery"
import { CommandEmpty, CommandGroup, CommandItem } from "@govblock/ui/components/nova/command"

// The `/` command in the search menu, stubbed (window 1, 2026-09-14): a
// query that starts with "/" is read as an address in the corpus
// (docs/xml/schema.md) rather than searched for, and the menu lists the
// Works under it. "@" is the citation resolver's, window 4's: the seam is
// `corpusMode`, which already routes it here with nothing to list yet.

export type CorpusMode = "slash" | "at" | null

export const corpusMode = (term: string): CorpusMode => (term.startsWith("/") ? "slash" : term.startsWith("@") ? "at" : null)

export function useSlashLibrary(term: string, active: boolean) {
  const [result, setResult] = React.useState<SlashResponse | null>(null)
  const [pending, setPending] = React.useState(false)
  const mode = corpusMode(term)
  React.useEffect(() => {
    if (!active || mode !== "slash" || term.length < 2) {
      setResult(null)
      return
    }
    let cancelled = false
    setPending(true)
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(`/api/typeset/slash?q=${encodeURIComponent(term)}`)
        const body = (await response.json()) as SlashResponse
        if (!cancelled) setResult(body)
      } catch {
        if (!cancelled) setResult(null)
      } finally {
        if (!cancelled) setPending(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [active, mode, term])
  return { mode, result, pending }
}

const LABEL = "w-48 shrink-0 truncate font-medium"

export function SlashResults({ mode, result, pending, term, go }: { mode: CorpusMode; result: SlashResponse | null; pending: boolean; term: string; go: (href: string) => void }) {
  if (mode === "at") return <CommandEmpty>Citations by @ arrive with the library.</CommandEmpty>
  if (term.length < 2) return <CommandEmpty>/119, /6644, /hr6644, /new-york-code, or an address like /us/bill/119/hr/6644</CommandEmpty>
  if (!result) return <CommandEmpty>{pending ? "Reading the corpus…" : "Nothing at that address."}</CommandEmpty>
  if (!result.items.length && !result.href) return <CommandEmpty>{pending ? "Reading the corpus…" : `Nothing under ${result.label || term}.`}</CommandEmpty>
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
