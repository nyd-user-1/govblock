"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@govblock/ui/components/ny4/button"
import { Input } from "@govblock/ui/components/ny4/input"

// The register's search. A GET to the page itself rather than a fetch: the
// result is a page of the register, so it deserves a URL a reader can send.
export function LobbyingSearch({ term }: { term: string }) {
  const router = useRouter()
  const [value, setValue] = React.useState(term)
  return (
    <form
      data-not-typeset="true"
      className="not-typeset flex gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const q = value.trim()
        router.push(q ? `/docs/lobbying?q=${encodeURIComponent(q)}` : "/docs/lobbying")
      }}
    >
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search firms, clients and lobbyists by name…"
        aria-label="Search the lobbying register"
        className="max-w-96"
      />
      <Button type="submit" variant="secondary" className="shadow-none">
        Search
      </Button>
    </form>
  )
}
