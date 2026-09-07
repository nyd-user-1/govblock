"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { History, Search } from "lucide-react"

import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { SearchResults, useSiteSearch } from "@/components/command-menu"
import { useRecents } from "@/components/home/recents"
import { cn } from "@govblock/ui/lib/utils"
import { Command, CommandGroup, CommandItem, CommandList, CommandRawInput } from "@govblock/ui/components/nova/command"
import { Kbd } from "@govblock/ui/components/nova/kbd"

// The big search under the greeting (Brendan, 2026-09-07: Cloudflare's
// account home). The bar is the site's search itself, not a button to the
// ⌘K dialog: focus it and the results drop down from it — the pages opened
// last and the site's pages before a word is typed, the jurisdiction's
// bills, members and committees after — and ⌘K on this page lands here,
// ahead of the header's dialog. Forty pixels tall (Brendan, 2026-09-07).

export function HomeSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const { state } = useJurisdiction()
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState("")
  const input = React.useRef<HTMLInputElement>(null)
  const recents = useRecents(5)
  const lead = recents[0] ? `recent-${recents[0].href}` : undefined
  const search = useSiteSearch({ active: open, term, lead })

  // ⌘K here focuses the bar. The header's dialog listens on the document, so
  // this listens on the window in the capture phase and stops the key there.
  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        event.stopPropagation()
        input.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", down, true)
    return () => window.removeEventListener("keydown", down, true)
  }, [])

  // A page change closes the list; so does a choice from it.
  React.useEffect(() => setOpen(false), [pathname])
  const close = () => {
    setOpen(false)
    input.current?.blur()
  }
  const go = (href: string) => {
    close()
    setTerm("")
    router.push(href)
  }

  const showRecents = search.query.length < 2 && recents.length > 0

  return (
    <Command
      shouldFilter={false}
      value={search.selected}
      onValueChange={search.setSelected}
      className="relative w-full overflow-visible rounded-none! bg-transparent p-0 text-foreground"
      onFocusCapture={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") close()
      }}
    >
      <label
        className={cn(
          "flex h-10 w-full cursor-text items-center gap-3 rounded-xl border bg-background px-3 text-[15px] shadow-xs ring-4 ring-muted/60 transition-[box-shadow,border-color]",
          open && "border-ring/60 ring-ring/15"
        )}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <CommandRawInput
          ref={input}
          value={term}
          onValueChange={setTerm}
          placeholder="Search"
          aria-label="Search"
          className="h-full min-w-0 flex-1 bg-transparent text-foreground outline-hidden placeholder:text-muted-foreground"
        />
        <span className="flex items-center gap-1">
          <Kbd className="border bg-background">⌘</Kbd>
          <Kbd className="border bg-background">K</Kbd>
        </span>
      </label>
      {open && (
        // The list keeps the bar's focus: a press inside it must not blur the
        // input, or the list would close before the click landed on a row.
        <div
          className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg [&_[cmdk-item]]:py-2"
          onMouseDown={(event) => event.preventDefault()}
        >
          <CommandList className="max-h-[420px]">
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
          <div className="flex items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd className="border bg-background">↑</Kbd>
              <Kbd className="border bg-background">↓</Kbd> to navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd className="border bg-background">↵</Kbd> to select
            </span>
          </div>
        </div>
      )}
    </Command>
  )
}
