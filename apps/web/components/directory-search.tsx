"use client"

import { Search, X } from "lucide-react"

import { Field } from "@govblock/ui/components/nova/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@govblock/ui/components/nova/input-group"

// Ported from livingston-v3 components/directory-search.tsx. The count that
// sat at the right of the field ("400 candidates") is gone from every search
// box (Brendan, 2026-09-03); the list beneath says what it holds.
export function SearchDirectory({
  query,
  setQuery,
  placeholder = "Search",
}: {
  query: string
  setQuery: (value: string | null) => void
  placeholder?: string
}) {
  return (
    <Field>
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput className="h-full" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        <InputGroupAddon align="inline-end" data-disabled={!query.length} className="data-[disabled=true]:hidden">
          <InputGroupButton aria-label="Clear" size="icon-xs" onClick={() => setQuery(null)}>
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}
