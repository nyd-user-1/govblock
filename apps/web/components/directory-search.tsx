"use client"

import { Search, X } from "lucide-react"

import { Field } from "@govblock/ui/components/nova/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@govblock/ui/components/nova/input-group"

// Ported verbatim from livingston-v3 components/directory-search.tsx.
export function SearchDirectory({
  query,
  registriesCount,
  setQuery,
  placeholder = "Search",
  noun = "member",
  nounPlural,
}: {
  query: string
  registriesCount: number
  setQuery: (value: string | null) => void
  placeholder?: string
  noun?: string
  nounPlural?: string
}) {
  const plural = nounPlural ?? `${noun}s`
  return (
    <Field>
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput className="h-full" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        <InputGroupAddon align="inline-end">
          <span className="text-muted-foreground tabular-nums sm:text-xs">
            {registriesCount} {registriesCount === 1 ? noun : plural}
          </span>
        </InputGroupAddon>
        <InputGroupAddon align="inline-end" data-disabled={!query.length} className="data-[disabled=true]:hidden">
          <InputGroupButton aria-label="Clear" size="icon-xs" onClick={() => setQuery(null)}>
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}
