"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Blocks } from "lucide-react"

import { EMPTY, hasBlock, recordOfPath, toggleBlock, useBlocks } from "@/lib/blocks-store"
import { Button } from "@govblock/ui/components/ny4/button"

// The block button, before the bookmark on every record page (Brendan,
// 2026-09-22): one press and this bill, this member, this committee stands on
// the account home's Blocks grid; a second press takes it off again. What the
// record is comes from the address (lib/blocks-store.ts), so a page carries
// the button without being told what it is — and a page that stands for no
// record carries nothing.

export function AddBlockButton({ title }: { title: string }) {
  const pathname = usePathname() ?? "/"
  const saved = useBlocks()
  const [search, setSearch] = React.useState("")
  // The query is the browser's, so it is read after the page has mounted, as the bookmark's address is.
  React.useEffect(() => setSearch(window.location.search), [pathname])

  const found = React.useMemo(() => recordOfPath(pathname, search, title), [pathname, search, title])
  if (!found) return null

  const kept = hasBlock(saved, found.key, found.record)
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={kept ? "Remove from blocks" : "Add to blocks"}
      aria-pressed={kept}
      title={kept ? "On your home page" : "Add to your home page"}
      onClick={() => toggleBlock(found.key, found.record, saved ?? EMPTY)}
      className="size-8 shadow-none md:size-7"
    >
      <Blocks className={kept ? "fill-current" : undefined} />
    </Button>
  )
}
