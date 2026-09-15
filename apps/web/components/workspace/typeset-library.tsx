"use client"

import * as React from "react"
import { LoadingFlag } from "@/components/loading-flag"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpDownIcon, CheckIcon, ChevronDownIcon, FileCodeIcon, FolderIcon, LibraryIcon } from "lucide-react"

import type { SlashItem, SlashResponse } from "@/app/api/typeset/slash/route"
import type { FindItem, FindResponse } from "@/lib/typeset/find"
import type { FolderItem, LibrarySort, Listing, WorkItem } from "@/lib/xml/library-data"
import { FAMILIES } from "@/lib/xml/families"
import { LIBRARY_ROOT, libraryHref } from "@/lib/xml/library"
import { FlagChip } from "@/components/policy/imagery"
import { CodeOutlineGroup } from "@/components/workspace/typeset-code-outline"
import { TypesetFrame } from "@/components/workspace/typeset-frame"
import { Button } from "@govblock/ui/components/ny4/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { Input } from "@govblock/ui/components/ny4/input"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { ToggleGroup, ToggleGroupItem } from "@govblock/ui/components/ny4/toggle-group"
import { cn } from "@govblock/ui/lib/utils"

// The Library (window 4, 2026-09-14): the corpus as libraries a reader
// browses, filters, sorts and loads a Work from into the XML view. The page
// draws what lib/xml/library-data.ts resolved on the server; filters and
// sorts are the URL's, so a library is a link; "More" reads the next page
// from /api/typeset/library. The filter box is also the `/` door: a query
// that starts with "/" resolves through the address (docs/xml/schema.md), and
// the "/" key focuses it. Words typed also search the law beyond this library
// (lib/typeset/find.ts): citations and section headings, asked as typing
// pauses, never on load.

const SORT_LABEL: Record<LibrarySort, string> = { address: "Address", newest: "Newest", coverage: "Lowest coverage" }

const fmtDay = (date: string | null) => (date ? new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—")
const fmtCount = (n: number) => n.toLocaleString("en-US")
const stateOf = (jurisdiction: string) => (jurisdiction === "us" ? "US" : jurisdiction.slice(3).toUpperCase())

function Coverage({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return <span className={cn("tabular-nums", value < 0.8 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{(value * 100).toFixed(1)}%</span>
}

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

function useLibraryNavigation(listing: Listing, replace: boolean) {
  const router = useRouter()
  return React.useCallback(
    (patch: Partial<Record<"sort" | "q" | "j" | "show", string | null>>, path = listing.path) => {
      const query = { sort: listing.query.sort, q: listing.query.q, j: listing.query.j, show: listing.query.show, ...patch }
      const sp = new URLSearchParams()
      if (query.sort && query.sort !== "address") sp.set("sort", query.sort)
      if (query.q) sp.set("q", query.q)
      if (query.j && path === listing.path) sp.set("j", query.j)
      if (query.show && query.show !== "all" && query.show !== listing.shows[0]?.value) sp.set("show", query.show)
      const href = `${libraryHref(path)}${sp.size ? `?${sp}` : ""}`
      if (replace) router.replace(href, { scroll: false })
      else router.push(href)
    },
    [listing, replace, router]
  )
}

/** The filter box, and the `/` door when what is typed starts with "/". `onFind` hears the words once typing pauses. */
function LibraryFilter({ listing, navigate, onFind }: { listing: Listing; navigate: ReturnType<typeof useLibraryNavigation>; onFind: (words: string) => void }) {
  const router = useRouter()
  const input = React.useRef<HTMLInputElement>(null)
  const [value, setValue] = React.useState(listing.query.q)
  const [slash, setSlash] = React.useState<SlashResponse | null>(null)
  const [open, setOpen] = React.useState(false)
  const typedAt = React.useRef(listing.query.q)

  React.useEffect(() => {
    setValue(listing.query.q)
    typedAt.current = listing.query.q
  }, [listing.query.q])

  // A plain filter narrows this library once typing pauses.
  React.useEffect(() => {
    if (value.startsWith("/") || value === typedAt.current) return
    const handle = setTimeout(() => {
      typedAt.current = value
      navigate({ q: value || null })
      onFind(value)
    }, 350)
    return () => clearTimeout(handle)
  }, [value, navigate, onFind])

  // A slash query reads the corpus by address.
  React.useEffect(() => {
    if (!value.startsWith("/") || value.length < 2) {
      setSlash(null)
      return
    }
    let live = true
    const handle = setTimeout(() => {
      fetch(`/api/typeset/slash?q=${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then((body: SlashResponse) => live && setSlash(body))
        .catch(() => live && setSlash(null))
    }, 200)
    return () => {
      live = false
      clearTimeout(handle)
    }
  }, [value])

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || isTyping(event.target)) return
      event.preventDefault()
      setValue("/")
      setOpen(true)
      input.current?.focus()
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const items = slash?.items ?? []
  const go = (item: SlashItem | undefined) => {
    const href = item?.href ?? slash?.href
    if (!href) return
    setOpen(false)
    setValue("")
    router.push(href)
  }

  return (
    <div className="relative">
      <Input
        ref={input}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value.startsWith("/")) go(items[0])
          if (event.key === "Enter" && !value.startsWith("/")) onFind(value)
          if (event.key === "Escape") {
            setValue(listing.query.q)
            input.current?.blur()
          }
        }}
        placeholder="Filter, or / for an address"
        className="h-7 w-44 text-xs md:w-72"
        aria-label="Filter this library, or type / and an address"
      />
      {open && value.startsWith("/") && (slash?.href || items.length > 0) && (
        <div className="absolute top-8 left-0 z-50 w-max max-w-[36rem] min-w-72 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {slash?.href && (
            <button type="button" className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs whitespace-nowrap hover:bg-accent" onMouseDown={() => go(undefined)}>
              <LibraryIcon className="size-4 text-muted-foreground" />
              <span className="font-medium">{slash.label}</span>
            </button>
          )}
          {items.slice(0, 8).map((item) => (
            <button key={`${item.address}-${item.href}`} type="button" className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs whitespace-nowrap hover:bg-accent" onMouseDown={() => go(item)}>
              {item.state ? <FlagChip state={item.state} width={16} /> : <FileCodeIcon className="size-4 text-muted-foreground" />}
              <span className="font-medium">{item.label}</span>
              <span className="max-w-72 truncate text-muted-foreground">{item.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Menu<T extends string>({ label, icon, value, options, onSelect }: { label: string; icon?: React.ReactNode; value: T | null; options: { value: T | null; label: string }[]; onSelect: (value: T | null) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          {icon}
          {label}
          <ChevronDownIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-max min-w-44">
        {options.map((option) => (
          <DropdownMenuItem key={option.value ?? "any"} className="text-xs whitespace-nowrap" onSelect={() => onSelect(option.value)}>
            <CheckIcon className={cn("size-3.5", option.value !== value && "invisible")} />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FolderTable({ label, folders }: { label: string | null; folders: FolderItem[] }) {
  const [all, setAll] = React.useState(false)
  const shown = all ? folders : folders.slice(0, 300)
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="px-4 py-2 font-medium">{label ?? ""}</th>
          <th className="w-24 px-2 py-2 text-right font-medium">Works</th>
          <th className="hidden w-24 px-2 py-2 text-right font-medium sm:table-cell">Coverage</th>
          <th className="hidden w-32 px-4 py-2 text-right font-medium md:table-cell">Latest</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((f) => (
          <tr key={f.key} className="group/row border-b border-border/60 hover:bg-muted/40">
            <td className="px-4 py-1.5">
              <Link href={f.href} className="flex min-w-0 items-center gap-2.5">
                {f.jurisdiction && f.key === f.jurisdiction ? <FlagChip state={stateOf(f.jurisdiction)} width={20} /> : <FolderIcon className="size-4 shrink-0 text-muted-foreground" />}
                <span className="truncate font-medium group-hover/row:text-primary group-hover/row:underline">{f.name}</span>
                {f.detail && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{f.detail}</span>}
              </Link>
            </td>
            <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{fmtCount(f.works)}</td>
            <td className="hidden px-2 py-1.5 text-right sm:table-cell">
              <Coverage value={f.coverage} />
            </td>
            <td className="hidden px-4 py-1.5 text-right text-muted-foreground tabular-nums md:table-cell">{fmtDay(f.latest)}</td>
          </tr>
        ))}
        {!all && folders.length > shown.length && (
          <tr>
            <td colSpan={4} className="px-4 py-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAll(true)}>
                All {fmtCount(folders.length)}
              </Button>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function WorkTable({ works, flags, label = "Work" }: { works: WorkItem[]; flags: boolean; label?: string }) {
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="px-4 py-2 font-medium">{label}</th>
          <th className="hidden w-72 px-2 py-2 font-medium lg:table-cell">Address</th>
          <th className="hidden w-32 px-2 py-2 text-right font-medium md:table-cell">Date</th>
          <th className="w-24 px-4 py-2 text-right font-medium">Coverage</th>
        </tr>
      </thead>
      <tbody>
        {works.map((w) => (
          <tr key={w.work} className="group/row border-b border-border/60 hover:bg-muted/40">
            <td className="px-4 py-1.5">
              <Link href={w.href} className="flex min-w-0 items-center gap-2.5">
                {flags ? <FlagChip state={stateOf(w.jurisdiction)} width={20} /> : <FileCodeIcon className="size-4 shrink-0 text-muted-foreground" />}
                <span className="shrink-0 font-medium group-hover/row:text-primary group-hover/row:underline">{w.label}</span>
                {w.detail && <span className="truncate text-xs text-muted-foreground">{w.detail}</span>}
              </Link>
            </td>
            <td className="hidden truncate px-2 py-1.5 font-mono text-[11px] text-muted-foreground lg:table-cell">{w.work}</td>
            <td className="hidden px-2 py-1.5 text-right text-muted-foreground tabular-nums md:table-cell">{fmtDay(w.date)}</td>
            <td className="px-4 py-1.5 text-right">
              <Coverage value={w.coverage} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** A library path as the search's bounds: an address prefix stays inside; a family searches everywhere. */
const withinOf = (listing: Listing) => (listing.query.j ? `/${listing.query.j}` : /^us(?:-[a-z]{2})?(?:\/|$)/.test(listing.path) ? `/${listing.path}` : null)

/** Sections anywhere in the law whose citation or heading the filter's words name. */
function useFind(listing: Listing) {
  const [found, setFound] = React.useState<{ q: string; items: FindItem[] } | null>(null)
  const asked = React.useRef("")
  React.useEffect(() => setFound(null), [listing.path])
  const find = React.useCallback(
    (words: string) => {
      const typed = words.trim()
      asked.current = typed
      if (typed.length < 2 || typed.startsWith("/")) return setFound(null)
      const within = withinOf(listing)
      const sp = new URLSearchParams({ q: typed })
      if (within) sp.set("within", within)
      const jurisdiction = within?.split("/")[1]
      if (jurisdiction) sp.set("jurisdiction", jurisdiction)
      fetch(`/api/typeset/find?${sp}`)
        .then((r) => (r.ok ? (r.json() as Promise<FindResponse>) : null))
        .then((body) => asked.current === typed && setFound(body ? { q: typed, items: body.items } : null))
        .catch(() => asked.current === typed && setFound(null))
    },
    [listing]
  )
  return { found, find }
}

/** The controls and the list: the page's body, and the Library view's inside a bill. */
export function LibraryBody({ listing, replace = true }: { listing: Listing; replace?: boolean }) {
  const navigate = useLibraryNavigation(listing, replace)
  const { found, find } = useFind(listing)
  const [works, setWorks] = React.useState<WorkItem[] | null>(listing.works)
  const [more, setMore] = React.useState(listing.more)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    setWorks(listing.works)
    setMore(listing.more)
  }, [listing])

  const loadMore = async () => {
    if (!works) return
    setPending(true)
    const sp = new URLSearchParams({ path: listing.path, sort: listing.query.sort, q: listing.query.q, show: listing.query.show, offset: String(listing.offset + works.length) })
    if (listing.query.j) sp.set("j", listing.query.j)
    try {
      const body = (await (await fetch(`/api/typeset/library?${sp}`)).json()) as { listing?: Listing }
      if (body.listing?.works) {
        setWorks((current) => [...(current ?? []), ...body.listing!.works!])
        setMore(body.listing.more)
      }
    } finally {
      setPending(false)
    }
  }

  const flags = Boolean(listing.jurisdictions) || listing.query.show === "bills"
  const empty = !listing.groups.length && !works?.length && !found?.items.length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-1.5 border-b border-b-border px-4 py-1.5">
        <LibraryFilter listing={listing} navigate={navigate} onFind={find} />
        {listing.shows.length > 0 && (
          <ToggleGroup type="single" size="sm" value={listing.query.show} onValueChange={(value) => value && navigate({ show: value })} className="ml-1">
            {listing.shows.map((s) => (
              <ToggleGroupItem key={s.value} value={s.value} className="h-7 px-2.5 text-xs whitespace-nowrap">
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        {listing.jurisdictions && (
          <Menu
            label={listing.jurisdictions.find((j) => j.value === listing.query.j)?.label ?? "Every jurisdiction"}
            value={listing.query.j}
            options={[{ value: null, label: "Every jurisdiction" }, ...listing.jurisdictions]}
            onSelect={(j) => navigate({ j })}
          />
        )}
        <Menu<LibrarySort> label={SORT_LABEL[listing.query.sort]} icon={<ArrowUpDownIcon className="size-3.5" />} value={listing.query.sort} options={listing.sorts.map((s) => ({ value: s, label: SORT_LABEL[s] }))} onSelect={(sort) => navigate({ sort })} />
        {listing.total !== null && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{fmtCount(listing.total)} Works</span>}
      </div>
      {listing.note && <p className="shrink-0 border-b px-4 py-1.5 text-xs text-muted-foreground">{listing.note}</p>}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {found && found.items.length > 0 && (
          <WorkTable
            label={`Sections for “${found.q}”`}
            flags
            works={found.items.map((i) => ({ work: i.address, href: i.href, label: i.label, detail: i.heading, jurisdiction: i.jurisdiction, date: i.date, coverage: i.coverage }))}
          />
        )}
        {listing.groups.map((group) => (
          <FolderTable key={group.key} label={group.label} folders={group.folders} />
        ))}
        {works && works.length > 0 && <WorkTable works={works} flags={flags} />}
        {more && (
          <div className="px-4 py-3">
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={pending} onClick={loadMore}>
              {pending ? "Reading…" : "More"}
            </Button>
          </div>
        )}
        {empty && <p className="p-8 text-sm text-muted-foreground">{listing.query.q ? `Nothing here matches “${listing.query.q}”.` : "Nothing is stored here yet."}</p>}
      </div>
    </div>
  )
}

/** A library that is one code, US Code title or constitution: its outline goes in the rail. */
const outlinePrefix = (path: string) => (/^us(?:-[a-z]{2})?\/(?:(?:code|usc)\/[A-Za-z0-9.-]+|const)$/.test(path) ? `/${path}` : null)

function LibraryRail({ listing }: { listing: Listing }) {
  const router = useRouter()
  const family = listing.path.split("/")[0]
  const outline = outlinePrefix(listing.path)
  return (
    <SidebarContent>
      {outline && <CodeOutlineGroup prefix={outline} />}
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={listing.path === ""} onClick={() => router.push(LIBRARY_ROOT)}>
                <LibraryIcon />
                <span className="flex-1 truncate">Library</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Families</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {FAMILIES.map((f) => (
              <SidebarMenuItem key={f.slug}>
                <SidebarMenuButton isActive={family === f.slug || family.endsWith(`-${f.slug}`)} onClick={() => router.push(libraryHref(f.slug))}>
                  <FolderIcon />
                  <span className="flex-1 truncate">{f.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}

export function TypesetLibrary({ listing }: { listing: Listing }) {
  return (
    <TypesetFrame rail={<LibraryRail listing={listing} />} crumbs={listing.crumbs} railOpen={Boolean(outlinePrefix(listing.path))}>
      <LibraryBody listing={listing} />
    </TypesetFrame>
  )
}

/** The Library view inside a bill's Typeset: the library's top level, each choice opening the Library page. */
export function TypesetLibraryPane() {
  const [listing, setListing] = React.useState<Listing | null>(null)
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    let live = true
    fetch("/api/typeset/library")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { listing: Listing }) => live && setListing(body.listing))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])
  if (!listing) return <p className="p-8 text-sm text-muted-foreground">{failed ? "The library could not be read." : <LoadingFlag />}</p>
  return <LibraryBody listing={listing} replace={false} />
}
