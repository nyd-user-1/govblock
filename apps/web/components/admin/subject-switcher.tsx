"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { useCommittees, useMembers } from "@/components/admin/data"
import { honorific } from "@/lib/format"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@govblock/ui/components/nova/command"
import { Popover, PopoverContent, PopoverTrigger } from "@govblock/ui/components/nova/popover"
import { cn } from "@govblock/ui/lib/utils"

// The last crumb on a page about one thing is a switcher (Brendan,
// 2026-09-07): "Labor" opens the committees, "Senator Peter Parker" the
// members, each a searchable list under the jurisdiction in scope. The pick
// is written into the URL under the filter key the record already speaks —
// `committee`, `member` — so the crumb reads it back, the customizer agrees,
// and the page can read it too once it is built around a real one. Until a
// pick is made the crumb shows the page's default.

export type SubjectKind = "committee" | "member"

function useChoices(kind: SubjectKind): { value: string; label: string; hint?: string; keywords?: string[] }[] {
  const committees = useCommittees()
  const members = useMembers()
  return React.useMemo(() => {
    if (kind === "committee") return (committees.data ?? []).map((c) => ({ value: c.slug ?? c.committee_name, label: c.committee_name, hint: c.chamber, keywords: [c.chamber] }))
    return (members.data ?? []).map((m) => ({ value: String(m.people_id), label: `${honorific(m.role, m.chamber)} ${m.name}`, hint: [m.party, m.district].filter(Boolean).join(" · "), keywords: [m.name, m.party, m.chamber, m.district] }))
  }, [kind, committees.data, members.data])
}

export function SubjectSwitcher({ kind, fallback }: { kind: SubjectKind; fallback: string }) {
  const params = useUrlParams(["of"])
  const chosen = params.of
  const choices = useChoices(kind)
  const [open, setOpen] = React.useState(false)
  const current = choices.find((c) => c.value === chosen)
  const label = current?.label ?? (chosen ? chosen : fallback)
  const select = (value: string) => {
    writeUrlParams({ of: value === chosen ? null : value }, { history: "push" })
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`${kind === "committee" ? "Committee" : "Member"}: ${label}. Choose another`}
            className="inline-flex cursor-pointer items-center gap-1 rounded-sm whitespace-nowrap text-foreground outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {label}
        <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0" aria-label={kind === "committee" ? "Committees" : "Members"}>
        <Command loop className="rounded-lg!">
          <CommandInput placeholder={kind === "committee" ? "Search committees…" : "Search members…"} autoFocus />
          <CommandList className="max-h-80">
            <CommandEmpty>{choices.length ? "Nothing found." : "Loading…"}</CommandEmpty>
            <CommandGroup>
              {choices.map((c) => (
                <CommandItem key={c.value} value={c.value} keywords={[c.label, ...(c.keywords ?? [])]} onSelect={() => select(c.value)}>
                  <span className="truncate">{c.label}</span>
                  {c.hint && <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">{c.hint}</span>}
                  <CheckIcon className={cn("size-4 shrink-0", c.value === chosen ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
