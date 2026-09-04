"use client"

import * as React from "react"
import { CornerLeftUpIcon, FileTextIcon, FolderIcon } from "lucide-react"

import { type Node, type Target } from "@/lib/create/path"
import { partyName, stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import type { Scope } from "@/lib/policy/scope"
import { useFolder, type Avatar as AvatarSpec, type Row } from "@/lib/policy/use-folder"
import { BillCard, CommitteeCard, MemberCard } from "@/components/create/entity-card"
import { ago } from "@/components/create/timeline"
import { ChamberSeal, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { EditDetailsDialog, ProjectCard, ProjectGrid, useProjectDetails, type ProjectDetails } from "@/components/project-card"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// A folder on the stage, the way GitHub shows one: a table with `..` at the
// top in a rounded, bordered box, or the same rows as cards. Every folder
// renders through this one component. The path bar is the block's header
// (`path-bar.tsx`); this view only tells the header when the rows have
// scrolled under it.
//
// GitHub's table has one set of columns because files are all alike. Ours
// aren't, so each kind of folder has its own (Brendan, 2026-09-03): a roll
// call is Roll call · Bill · Type · Aye · Nay · Date, a member is Member ·
// Chamber · District · Party, and so on. A bill's second column is its latest
// version, the way a file's is its last commit: the version's name and the
// bill's title, the whole title on hover, and a click opens the version's
// changes rather than the bill.
//
// The Cards look draws the large card for a bill, a member or a committee and
// the small folder card for anything without a face or a seal.

export type Look = "table" | "cards"

function RowAvatar({ avatar, size = 28 }: { avatar: AvatarSpec; size?: number }) {
  switch (avatar.kind) {
    case "seal":
      return <ChamberSeal state={avatar.state} chamber={avatar.chamber} size={size} />
    case "portrait":
      return (
        <span className="relative shrink-0">
          <MemberPortrait name={avatar.name} photoUrl={avatar.photoUrl} state={avatar.state} chamber={avatar.chamber} size={size} />
          <PartyDot party={avatar.party} serving={avatar.serving} className="absolute -right-0.5 -bottom-0.5 size-2.5 ring-2 ring-card" />
        </span>
      )
    default:
      return <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
  }
}

function Sentinel({ onVisible, active }: { onVisible: () => void; active: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const node = ref.current
    if (!node || !active) return
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onVisible(), { rootMargin: "600px 0px" })
    observer.observe(node)
    return () => observer.disconnect()
  }, [onVisible, active])
  return <div ref={ref} aria-hidden className="h-px w-full" />
}

const today = () => new Date().toISOString().slice(0, 10)

// The roll call's own label, split: "House Roll Call Vote 297 HOUSE AMD A" is
// the roll call "House Roll Call Vote 297" of type "HOUSE AMD A".
function splitRollCall(description: string) {
  const m = /^(.*?(?:Vote|Passage|Reading|Tally Sheet)\s*\d*)\s*[-:]?\s*(.*)$/i.exec(description)
  if (m && m[2]) return { name: m[1].trim(), type: m[2].replace(/^[(\s]+|[)\s]+$/g, "").trim() }
  return { name: description, type: "" }
}

type Column = { key: string; label: string; className?: string; cell: (row: Row) => React.ReactNode }

/** The bill's last commit line: the action on the record that produced its
 *  latest version — "READ THE SECOND TIME AND AMENDED" — the way a file's
 *  last commit message describes the change, not the file. A click opens
 *  that version's changes. The bill's title stays in the name column's
 *  title attribute; there is no tooltip (Brendan, 2026-09-03 and 04). */
function LatestVersion({ row, onGo }: { row: Row; onGo: (go: Target) => void }) {
  if (row.record?.kind !== "bill") return <span className="text-muted-foreground">{truncate(row.description ?? "", 110)}</span>
  const b = row.record.bill
  const message = b.latest_action?.trim() || b.last_action?.trim() || b.title
  const line = <span className="text-muted-foreground">{truncate(message.charAt(0) + message.slice(1).toLowerCase() === message ? message : message.length > 12 && message === message.toUpperCase() ? message.charAt(0) + message.slice(1).toLowerCase() : message, 90)}</span>
  if (!b.latest_document_id) return line
  return (
    <button
      type="button"
      className="block max-w-full truncate text-left hover:[&>span]:text-primary hover:[&>span]:underline"
      onClick={(e) => {
        e.stopPropagation()
        onGo({ bill: String(b.bill_id), rollcall: null, tab: "changes", doc: String(b.latest_document_id) })
      }}
    >
      {line}
    </button>
  )
}

function columnsFor(node: Node, state: string, onGo: (go: Target) => void): Column[] {
  // The name is the row's link, coloured the way GitHub colours a file name:
  // plain until the row is hovered, then link-blue and underlined.
  const name = (row: Row, mono = false): React.ReactNode => (
    <span className={cn("flex items-center gap-2.5 font-medium", mono && "font-mono text-xs")}>
      {row.avatar.kind === "folder" ? <FolderIcon className="size-4 shrink-0 text-muted-foreground" /> : row.kind === "file" && row.avatar.kind === "seal" ? <FileTextIcon className="size-4 shrink-0 text-muted-foreground" /> : <RowAvatar avatar={row.avatar} size={22} />}
      <span className="truncate group-hover/row:text-primary group-hover/row:underline">{row.name}</span>
    </span>
  )
  const muted = (v: React.ReactNode) => <span className="text-muted-foreground">{v}</span>
  const right = "text-right tabular-nums"
  switch (node.kind) {
    case "sessions":
      return [
        { key: "name", label: "Session", cell: (r) => name(r) },
        { key: "bills", label: "Bills", className: right, cell: (r) => muted(fmtNumber(r.count ?? 0)) },
        { key: "scope", label: "", className: "w-32 text-right", cell: (r) => muted(r.description ?? "") },
      ]
    case "bills":
    case "committee":
      if (node.kind === "committee" && node.sub === "members") return columnsFor({ kind: "members" }, state, onGo).concat([{ key: "votes", label: "Committee votes", className: right, cell: (r) => muted(fmtNumber(r.count ?? 0)) }])
      // GitHub's three columns, and its names: a bill, its latest commit, and
      // when it last moved — "5 days ago", not a date (Brendan, 2026-09-03).
      // The commit sits at the right, by the time, as GitHub's does, and it
      // is the action that produced the latest version — what changed — not
      // the bill's description (Brendan, 2026-09-04).
      return [
        { key: "bill", label: "Bill", className: "w-[41%]", cell: (r) => name(r, true) },
        { key: "commit", label: "Commit", cell: (r) => <LatestVersion row={r} onGo={onGo} /> },
        { key: "date", label: "Last activity", className: `w-36 ${right}`, cell: (r) => muted(r.date ? ago(r.date) : "—") },
      ]
    case "forks":
      return [
        { key: "bill", label: "Bill", className: "w-36", cell: (r) => name(r, true) },
        { key: "title", label: "Forked from", cell: (r) => muted(r.record?.kind === "fork" ? `${stateName(r.record.fork.state)}${r.record.fork.session_id ? ` · ${r.record.fork.session_id}` : ""} — ${truncate(r.record.fork.title ?? "", 90)}` : "") },
        { key: "commits", label: "Commits", className: `w-24 ${right}`, cell: (r) => muted(fmtNumber(r.count ?? 0)) },
        { key: "date", label: "Forked", className: `w-36 ${right}`, cell: (r) => muted(r.date ? ago(r.date) : "—") },
      ]
    case "committees":
      return [
        { key: "name", label: "Committee", cell: (r) => name(r) },
        { key: "type", label: "Type", className: "w-32", cell: (r) => muted(r.record?.kind === "committee" ? (r.record.committee.chamber ?? "") : "") },
        { key: "bills", label: "Bills", className: `w-24 ${right}`, cell: (r) => muted(fmtNumber(r.count ?? 0)) },
      ]
    case "members":
      return [
        { key: "name", label: "Member", cell: (r) => name(r) },
        { key: "chamber", label: "Chamber", className: "w-32", cell: (r) => muted(r.record?.kind === "member" ? r.record.member.chamber : "") },
        { key: "district", label: "District", className: "w-32", cell: (r) => muted(r.record?.kind === "member" ? r.record.member.district?.replace(/^[A-Z]+-0*/, "") || "—" : "") },
        { key: "party", label: "Party", className: "w-32", cell: (r) => muted(r.record?.kind === "member" ? partyName(r.record.member.party) || r.record.member.party : "") },
        { key: "role", label: "Leadership", cell: (r) => muted(truncate(r.record?.kind === "member" ? (r.record.member.leadership_title ?? "") : "", 48)) },
      ]
    case "votes-kind":
      return [
        { key: "rollcall", label: "Roll call", cell: (r) => <span className="font-medium">{splitRollCall(r.name).name}</span> },
        { key: "bill", label: "Bill", className: "w-36", cell: (r) => <span className="flex items-center gap-2 font-mono text-xs">{r.avatar.kind === "seal" && <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />}{r.record?.kind === "rollcall" ? r.record.rollcall.bill_number : r.description}</span> },
        { key: "type", label: "Type", cell: (r) => muted(splitRollCall(r.name).type || "—") },
        { key: "aye", label: "Aye", className: `w-16 ${right}`, cell: (r) => muted(r.record?.kind === "rollcall" ? fmtNumber(r.record.rollcall.yea) : "") },
        { key: "nay", label: "Nay", className: `w-16 ${right}`, cell: (r) => muted(r.record?.kind === "rollcall" ? fmtNumber(r.record.rollcall.nay) : "") },
        { key: "date", label: "Date", className: `w-32 ${right}`, cell: (r) => muted(r.date ? fmtDate(r.date) : "") },
      ]
    case "votes":
    case "votes-month":
      return [
        { key: "name", label: node.kind === "votes" ? "Month" : "Where", cell: (r) => name(r) },
        { key: "desc", label: node.kind === "votes" ? "" : "Committees", cell: (r) => muted(r.description ?? "") },
        { key: "count", label: "Roll calls", className: `w-28 ${right}`, cell: (r) => muted(fmtNumber(r.count ?? 0)) },
        { key: "date", label: "Last activity", className: `w-32 ${right}`, cell: (r) => muted(r.date ? fmtDate(r.date) : "") },
      ]
    default:
      return [
        { key: "name", label: "Name", className: "w-[30%]", cell: (r) => name(r) },
        { key: "desc", label: "", cell: (r) => muted(r.description ?? "") },
        { key: "count", label: "Count", className: `w-24 ${right}`, cell: (r) => muted(r.count != null ? fmtNumber(r.count) : "") },
        { key: "date", label: "Last activity", className: `w-36 ${right}`, cell: (r) => muted(r.date ? fmtDate(r.date) : "—") },
      ]
  }
}

export function FolderView({ node, scope, look, scopeKey, scroller, onScrolled, up, tab, onTab, onGo }: { node: Node; scope: Scope; look: Look; /** Names the folder for its pinned-row and details storage. */ scopeKey: string; scroller: React.RefObject<HTMLDivElement | null>; onScrolled: (scrolled: boolean) => void; up: Target | null; tab: string; onTab: (tab: string) => void; onGo: (go: Target) => void }) {
  const folder = useFolder(node, scope)
  const { state } = scope
  const { pinned, togglePin, details, setDetails } = useProjectDetails(`tree:${state}:${scopeKey}`)
  const [editing, setEditing] = React.useState<string | null>(null)

  const rows = React.useMemo(() => {
    const rank = (p: string) => {
      const index = pinned.indexOf(p)
      return index < 0 ? Infinity : index
    }
    return [...folder.rows].sort((a, b) => rank(a.key) - rank(b.key))
  }, [folder.rows, pinned])

  // A committee's tabs are its two folders and its calendar; Bills and Members
  // are the same places the tree shows, so the tab writes the same key.
  const tabs = node.kind === "committee" ? ["bills", "members", "calendar"] : []
  const activeTab = node.kind === "committee" ? (tab === "calendar" ? "calendar" : node.sub) : tabs[0]
  const pickTab = (t: string) => {
    if (node.kind !== "committee") return
    if (t === "calendar") onTab("calendar")
    else onGo({ committee: node.name, at: t === "members" ? "members" : null, member: null, bill: null, rollcall: null })
  }
  const tabLabel = (t: string) => (t === "bills" ? "Bills" : t === "members" ? "Members" : "Calendar")
  const columns = columnsFor(node, state, onGo)

  const toggle = (value: string, active: boolean, onClick: () => void, label = value) => (
    <button key={value} type="button" data-active={active} onClick={onClick} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
      {label}
    </button>
  )

  if (activeTab === "calendar" && node.kind === "committee") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">{tabs.map((t) => toggle(t, activeTab === t, () => pickTab(t), tabLabel(t)))}</div>
        </div>
        <iframe src={`/calendar/month/${today()}?state=${state}${scope.filters.session ? `&session=${scope.filters.session}` : ""}&committee=${encodeURIComponent(node.name)}`} title={`${node.name} calendar`} className="min-h-0 flex-1 bg-background" />
      </div>
    )
  }

  const empty = !folder.loading && !rows.length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {tabs.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">{tabs.map((t) => toggle(t, activeTab === t, () => pickTab(t), tabLabel(t)))}</div>
        </div>
      )}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" onScroll={(e) => onScrolled(e.currentTarget.scrollTop > 8)}>
        {look === "cards" ? (
          <div className="p-6">
            {up && (
              <button type="button" onClick={() => onGo(up)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <CornerLeftUpIcon className="size-4" /> ..
              </button>
            )}
            <ProjectGrid className="xl:grid-cols-3">
              {rows.map((row) => {
                if (row.record?.kind === "bill") return <BillCard key={row.key} bill={row.record.bill} state={state} onOpen={(open) => onGo({ ...open.go, tab: undefined } as Target)} />
                if (row.record?.kind === "member") return <MemberCard key={row.key} member={row.record.member} state={state} onOpen={(open) => onGo(open.go)} />
                if (row.record?.kind === "committee") return <CommitteeCard key={row.key} committee={row.record.committee} state={state} onOpen={(open) => onGo(open.go)} />
                const detail = details[row.key] ?? {}
                return (
                  <ProjectCard
                    key={row.key}
                    href="#"
                    title={detail.label || row.name}
                    note={detail.note}
                    media={<RowAvatar avatar={row.avatar} />}
                    meta={[row.description ? truncate(row.description, 90) : null, row.count != null ? `${fmtNumber(row.count)} items` : null, row.date ? fmtDate(row.date) : null].filter(Boolean).join(" · ")}
                    menu={{ pinned: pinned.includes(row.key), onPin: () => togglePin(row.key), onEdit: () => setEditing(row.key), feedHref: `/docs/feed.xml?state=${state}&at=${encodeURIComponent(row.key)}` }}
                    className="cursor-pointer"
                  />
                )
              })}
            </ProjectGrid>
            {folder.loading && (
              <ProjectGrid className="mt-6 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-2xl" />
                ))}
              </ProjectGrid>
            )}
          </div>
        ) : (
          <div className="m-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={c.className}>
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {up && (
                  <TableRow className="group/row cursor-pointer" onClick={() => onGo(up)}>
                    <TableCell colSpan={columns.length} className="text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <FolderIcon className="size-4" /> <span className="group-hover/row:text-primary group-hover/row:underline">..</span>
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => (
                  <TableRow key={row.key} className="group/row cursor-pointer" onClick={() => onGo(row.go)}>
                    {columns.map((c, index) => (
                      <TableCell key={c.key} className={cn("max-w-0", c.className)}>
                        {index === 0 ? (
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 truncate">{c.cell(row)}</span>
                            {pinned.includes(row.key) && <span className="text-xs text-muted-foreground">pinned</span>}
                          </span>
                        ) : (
                          <span className="block truncate">{c.cell(row)}</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {folder.loading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`s-${i}`}>
                      <TableCell colSpan={columns.length}>
                        <Skeleton className="h-4 w-2/3" />
                      </TableCell>
                    </TableRow>
                  ))}
                {empty && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                      {node.kind === "committee" && node.sub === "members" ? `No committee votes on file for ${node.name} this session, so no roster can be read from them yet.` : `Nothing here for ${stateName(state)} under these filters.`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <Sentinel active={!folder.done && !folder.loading} onVisible={folder.more} />
        {folder.done && folder.total != null && folder.total > 50 && <p className="py-6 text-center text-xs text-muted-foreground">That is every one of the {fmtNumber(folder.total)}.</p>}
      </div>
      <EditDetailsDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} id={editing} fallbackLabel={editing ? (rows.find((r) => r.key === editing)?.name ?? editing) : ""} value={(editing ? details[editing] : undefined) ?? {}} onSave={(next: ProjectDetails) => setDetails((current) => ({ ...current, [editing ?? ""]: next }))} />
    </div>
  )
}
