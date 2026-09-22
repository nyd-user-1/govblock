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
  onSubmit,
  className,
  tools,
}: {
  query: string
  setQuery: (value: string | null) => void
  placeholder?: string
  /**
   * Where the field waits for Enter rather than searching on every keystroke
   * (Brendan, 2026-09-20): /search asks the database for six sections and the
   * bill text, and a half-typed word was a query of its own.
   */
  onSubmit?: () => void
  /** The field's own look, where a page wants one: the site search's bar (components/search-page.tsx). */
  className?: string
  /** Buttons at the field's right that stay whatever is typed: the site search's filter icon (2026-09-22). */
  tools?: React.ReactNode
}) {
  const field = (
    <Field>
      <InputGroup className={className}>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput className="h-full" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        <InputGroupAddon align="inline-end" data-disabled={!query.length} className="data-[disabled=true]:hidden">
          <InputGroupButton type="button" aria-label="Clear" size="icon-xs" onClick={() => setQuery(null)}>
            <X />
          </InputGroupButton>
        </InputGroupAddon>
        {tools && <InputGroupAddon align="inline-end">{tools}</InputGroupAddon>}
      </InputGroup>
    </Field>
  )
  if (!onSubmit) return field
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      {field}
    </form>
  )
}
