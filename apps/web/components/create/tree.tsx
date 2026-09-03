"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronRightIcon, FileTextIcon, FolderIcon, FolderOpenIcon, SearchIcon, XIcon } from "lucide-react"

import { keyOf, locate, ROOT_FOLDERS, type Location, type Node, type Target } from "@/lib/create/path"
import { partyName, stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { useSessionTitle, type Scope } from "@/lib/policy/scope"
import { useFolder, type Row } from "@/lib/policy/use-folder"
import { useSnapshot } from "@/lib/policy/use-policy"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInput, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// The tree inside one session — the repository's file tree. Bills, then
// Committees (each with Bills and Members), Members, and Votes by month, on
// the floor and in committee. Folders load when opened, through the same
// loader the stage's table reads, so the tree and the table are one listing.
//
// "Go to file" is a find, not a filter: it asks the search route for bills,
// members and committees that match and lists them flat.

type SearchAnswer = {
  bills: { bill_id: number; bill_number: string; title: string; state: string }[]
  members: { people_id: number; name: string; chamber: string; party: string; state: string }[]
  committees: { committee: string; chamber: string; bills: number; state: string }[]
}

/** What the legislature calls itself: "United States Congress", "Alaska State Legislature". */
export function legislatureName(state: string) {
  if (state === "US") return "United States Congress"
  if (state === "DC") return "Council of the District of Columbia"
  return `${stateName(state)} State Legislature`
}

const locationOf = (go: Target): Location => ({ at: go.at ?? "", committee: go.committee ?? "", member: go.member ?? "", bill: go.bill ?? "", rollcall: go.rollcall ?? "" })

type TreeProps = { active: string; open: (key: string) => boolean; onToggle: (key: string) => void; onGo: (go: Target) => void; scope: Scope }

function Branch({ row, depth, tree }: { row: Row; depth: number; tree: TreeProps }) {
  const isOpen = row.kind === "folder" && tree.open(row.key)
  const active = tree.active === row.key || (tree.active.startsWith("committees/*/") && row.key.replace(/^committees\/[^/]*\//, "committees/*/") === tree.active)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        onClick={() => {
          tree.onGo(row.go)
          if (row.kind === "folder" && !isOpen) tree.onToggle(row.key)
        }}
        title={row.description ? `${row.name} — ${row.description}` : row.name}
        className="gap-1.5"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {row.kind === "folder" ? (
          <span
            role="button"
            aria-label={isOpen ? "Collapse" : "Expand"}
            className="-ml-1 flex size-4 shrink-0 items-center justify-center rounded opacity-60 hover:bg-muted hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              tree.onToggle(row.key)
            }}
          >
            {isOpen ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {row.kind === "folder" ? isOpen ? <FolderOpenIcon className="size-4 shrink-0 text-muted-foreground" /> : <FolderIcon className="size-4 shrink-0 text-muted-foreground" /> : <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />}
        <span className={cn("truncate", row.kind === "file" && row.key.startsWith("bills/") && "font-mono text-xs")}>{row.name}</span>
        {row.count != null && <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{fmtNumber(row.count)}</span>}
      </SidebarMenuButton>
      {isOpen && (row.record?.kind === "committee" ? <CommitteeBranches name={row.record.committee.committee_name} chamber={row.record.committee.chamber ?? ""} depth={depth + 1} tree={tree} /> : <Children node={locate(locationOf(row.go))} depth={depth + 1} tree={tree} />)}
    </SidebarMenuItem>
  )
}

// A committee is a folder of two folders: the bills referred to it, and the
// members who vote in it.
function CommitteeBranches({ name, chamber, depth, tree }: { name: string; chamber: string; depth: number; tree: TreeProps }) {
  const subs: Row[] = [
    { key: `committees/${chamber}/${name}/bills`, name: "Bills", kind: "folder", go: { committee: name, chamber: chamber || null, at: null, member: null, bill: null, rollcall: null }, avatar: { kind: "folder" } },
    { key: `committees/${chamber}/${name}/members`, name: "Members", kind: "folder", go: { committee: name, chamber: chamber || null, at: "members", member: null, bill: null, rollcall: null }, avatar: { kind: "folder" } },
  ]
  return (
    <SidebarMenu className="ml-2 border-l pl-0">
      {subs.map((row) => (
        <Branch key={row.key} row={row} depth={depth} tree={tree} />
      ))}
    </SidebarMenu>
  )
}

// A folder's children, mounted only while it is open, which is what makes the
// loading lazy: the hook runs when the branch is on screen and not before.
function Children({ node, depth, tree }: { node: Node; depth: number; tree: TreeProps }) {
  const folder = useFolder(node, tree.scope)
  return (
    <SidebarMenu className="ml-2 border-l pl-0">
      {folder.rows.map((row) => (
        <Branch key={row.key} row={row} depth={depth} tree={tree} />
      ))}
      {folder.loading && (
        <SidebarMenuItem>
          <span className="block px-2 py-1 text-xs text-muted-foreground" style={{ paddingLeft: `${8 + depth * 12}px` }}>
            Loading…
          </span>
        </SidebarMenuItem>
      )}
      {!folder.loading && !folder.rows.length && (
        <SidebarMenuItem>
          <span className="block px-2 py-1 text-xs text-muted-foreground" style={{ paddingLeft: `${8 + depth * 12}px` }}>
            {node.kind === "committee" && node.sub === "members" ? "No committee votes on file yet" : "Empty"}
          </span>
        </SidebarMenuItem>
      )}
      {!folder.done && !folder.loading && (
        <SidebarMenuItem>
          <SidebarMenuButton onClick={folder.more} className="text-xs text-muted-foreground" style={{ paddingLeft: `${8 + depth * 12}px` }}>
            More…{folder.total != null ? ` (${fmtNumber(folder.rows.length)} of ${fmtNumber(folder.total)})` : ""}
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
    </SidebarMenu>
  )
}

/** The branches above the node the URL names, so they open with it. */
export function ancestorsOf(loc: Location, node: Node, chamber = ""): string[] {
  const out: string[] = []
  if (loc.committee) {
    // The chamber names which house's committee; without one, either opens.
    const c = chamber || "*"
    out.push("committees", `committees/${c}/${loc.committee}`)
    if (node.kind === "member" || (node.kind === "committee" && node.sub === "members")) out.push(`committees/${c}/${loc.committee}/members`)
    else out.push(`committees/${c}/${loc.committee}/bills`)
    return out
  }
  const at = loc.at.split("/").filter(Boolean).map(decodeURIComponent)
  if (node.kind === "bill" || node.kind === "bills") return ["bills"]
  if (node.kind === "member" || node.kind === "members") return ["members"]
  if (node.kind === "committees") return ["committees"]
  if (at[0] === "votes") {
    out.push("votes")
    if (at[1]) out.push(`votes/${at[1]}`)
    if (at[2]) out.push(`votes/${at[1]}/${at[2]}`)
  }
  return out
}

export function Tree({ scope, location, node, onGo }: { scope: Scope; location: Location; node: Node; onGo: (go: Target) => void }) {
  const { state, session, resolved } = scope
  const sessionTitle = useSessionTitle(state, session)
  const [opened, setOpened] = React.useState<Set<string>>(() => new Set())
  const [closed, setClosed] = React.useState<Set<string>>(() => new Set())
  const [query, setQuery] = React.useState("")

  const ancestors = React.useMemo(() => new Set(ancestorsOf(location, node, scope.filters.chamber ?? "")), [location, node, scope.filters.chamber])
  const isAncestor = React.useCallback((key: string) => ancestors.has(key) || [...ancestors].some((a) => a.includes("/*/") && key.replace(/^committees\/[^/]*\//, "committees/*/") === a), [ancestors])
  const open = React.useCallback((key: string) => !closed.has(key) && (opened.has(key) || isAncestor(key)), [opened, closed, isAncestor])
  const toggle = React.useCallback(
    (key: string) => {
      if (open(key)) {
        setClosed((s) => new Set(s).add(key))
        setOpened((s) => {
          const n = new Set(s)
          n.delete(key)
          return n
        })
      } else {
        setOpened((s) => new Set(s).add(key))
        setClosed((s) => {
          const n = new Set(s)
          n.delete(key)
          return n
        })
      }
    },
    [open]
  )
  const tree: TreeProps = { active: keyOf(node), open, onToggle: toggle, onGo, scope }

  const q = query.trim()
  const params = new URLSearchParams({ q, state, limit: "12" })
  if (session) params.set("session", String(session))
  const { data: found, isLoading: searching } = useSnapshot<SearchAnswer>(resolved && q.length >= 2 ? `/api/policy/search?${params}` : null)

  const roots: Row[] = ROOT_FOLDERS.map((f) => ({ key: f.key, name: f.label, kind: "folder", go: { ...f.go, committee: null, member: null, bill: null, rollcall: null }, avatar: { kind: "folder" } }))

  return (
    <>
      <SidebarHeader className="p-2">
        <div className="relative">
          <SidebarInput placeholder="Go to file…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Go to file" className="pr-7" onKeyDown={(e) => e.key === "Escape" && setQuery("")} />
          {query ? (
            <button type="button" aria-label="Clear" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <XIcon className="size-3.5" />
            </button>
          ) : (
            <SearchIcon className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {q.length >= 2 ? (
          <SidebarGroup>
            <SidebarGroupLabel>{searching || !found ? "Searching…" : `Matches for “${q}”`}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(found?.bills ?? []).map((b) => (
                  <SidebarMenuItem key={`b-${b.bill_id}`}>
                    <SidebarMenuButton onClick={() => onGo({ bill: String(b.bill_id), rollcall: null })} title={b.title} className="gap-1.5">
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono text-xs">{b.bill_number}</span>
                      <span className="truncate text-xs text-muted-foreground">{b.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {(found?.members ?? []).map((m) => (
                  <SidebarMenuItem key={`m-${m.people_id}`}>
                    <SidebarMenuButton onClick={() => onGo({ member: String(m.people_id), committee: null, bill: null, rollcall: null })} className="gap-1.5">
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{m.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {m.chamber} · {partyName(m.party) || m.party}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {(found?.committees ?? []).map((c) => (
                  <SidebarMenuItem key={`c-${c.chamber}-${c.committee}`}>
                    <SidebarMenuButton onClick={() => onGo({ committee: c.committee, at: null, member: null, bill: null, rollcall: null })} className="gap-1.5">
                      <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.committee}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{fmtNumber(c.bills)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {found && !found.bills.length && !found.members.length && !found.committees.length && (
                  <SidebarMenuItem>
                    <span className="px-2 text-xs text-muted-foreground">Nothing matches.</span>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            {/* The repository's name: the session. The organization above it
                is a click away on the label. */}
            <SidebarGroupLabel className="cursor-pointer" onClick={() => onGo({ at: null, committee: null, member: null, bill: null, rollcall: null })} title={`${legislatureName(state)} · ${sessionTitle}`}>
              {sessionTitle || "…"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {roots.map((row) => (
                  <Branch key={row.key} row={row} depth={0} tree={tree} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </>
  )
}
