"use client"

import * as React from "react"
import { MailPlusIcon, MoreHorizontalIcon, SearchIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { useLocal } from "@/lib/policy/use-local"
import { matchesQuery } from "@/lib/search-match"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { StatDatabaseGrid, type DbStat } from "@/components/admin/blocks/stats"
import { PageTitle } from "@/components/admin/page-title"
import { parseContacts, type ParsedContact, type SkippedRow } from "./invitees-parse"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@govblock/ui/components/nova/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { Input } from "@govblock/ui/components/nova/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { Textarea } from "@govblock/ui/components/nova/textarea"
import { cn } from "@govblock/ui/lib/utils"

// Invitees: who is being asked onto the platform, and how far each of them
// got. The Roster's table, the Data Pipeline's tiles.
//
// Two things are deliberately unfinished, and the surface says both rather
// than letting anyone find out later:
//
//  1. The list is this browser's localStorage, the Agentic Inbox's pattern
//     (lib/agents/inbox.ts) and for the same reason — govblock has no accounts
//     yet, so a server-side list would be one list shared by every visitor. A
//     table and real persistence come with the send step, which is the point at
//     which the list has to outlive the browser that typed it.
//  2. Sending is a stub. The seam is here — one button a row, one for the whole
//     list — and behind it goes Resend, from an nysgpt.com address (the domain
//     is already verified), copying the Clerk so a reply reaches an agent that
//     can onboard the invitee rather than an inbox nobody reads.

const KEY = "govblock.invitees.v1"
const PAGE = 10

export type InviteeStatus = "not-invited" | "invited" | "replied" | "joined"

export type Invitee = ParsedContact & {
  status: InviteeStatus
  /** ISO date, the day the row was added. */
  added: string
}

const STATUSES: { value: InviteeStatus; label: string; tone: string }[] = [
  { value: "not-invited", label: "Not invited", tone: "text-muted-foreground" },
  { value: "invited", label: "Invited", tone: "text-amber-600" },
  { value: "replied", label: "Replied", tone: "text-violet-600" },
  { value: "joined", label: "Joined", tone: "text-green-600" },
]
const statusOf = (value: InviteeStatus) => STATUSES.find((s) => s.value === value) ?? STATUSES[0]

const today = () => new Date().toISOString().slice(0, 10)
const fmtAdded = (value: string) => {
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : value
}

/** n things, named. "1 contact", "4 contacts". */
const count = (n: number, word: string, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`

// ---------------------------------------------------------------------------

/**
 * The loader. A file dropped or chosen, or a list pasted — all of it is text
 * by the time it reaches the parser, so the three are one field with three
 * ways in. Nothing is added until the count has been read and agreed to.
 */
function AddContacts({ existing, onAdd }: { existing: Invitee[]; onAdd: (contacts: ParsedContact[]) => void }) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")
  const [file, setFile] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [failed, setFailed] = React.useState<string | null>(null)
  const input = React.useRef<HTMLInputElement>(null)

  const held = React.useMemo(() => new Set(existing.map((row) => row.email)), [existing])

  // What the pasted text says, split three ways: what will be added, what is
  // already on the list, and what could not be read.
  const read = React.useMemo(() => {
    const { contacts, skipped, header } = parseContacts(text)
    const fresh: ParsedContact[] = []
    const duplicates: ParsedContact[] = []
    const seen = new Set<string>()
    for (const contact of contacts) {
      // Twice in one file is a duplicate too, and the first spelling wins.
      if (held.has(contact.email) || seen.has(contact.email)) duplicates.push(contact)
      else {
        seen.add(contact.email)
        fresh.push(contact)
      }
    }
    return { fresh, duplicates, skipped, header, total: contacts.length }
  }, [text, held])

  const take = async (chosen: File | null | undefined) => {
    if (!chosen) return
    setFailed(null)
    try {
      const body = await chosen.text()
      setFile(chosen.name)
      setText(body)
    } catch {
      setFailed(`${chosen.name} could not be read.`)
    }
  }

  const reset = () => {
    setText("")
    setFile(null)
    setFailed(null)
    setDragging(false)
  }

  const commit = () => {
    onAdd(read.fresh)
    reset()
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <UploadIcon className="size-4" />
            Add contacts
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add contacts</DialogTitle>
          <DialogDescription>
            A CSV export, or a pasted list. Name, email and organization are picked out of whatever columns the file
            uses; rows already on the list are left alone.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void take(e.dataTransfer.files?.[0])
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30"
          )}
        >
          <UploadIcon className={cn("size-5", dragging ? "text-primary" : "text-muted-foreground")} />
          <p className="text-sm text-foreground">
            Drop a CSV here, or{" "}
            <button type="button" onClick={() => input.current?.click()} className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline">
              choose a file
            </button>
          </p>
          <p className="text-xs text-muted-foreground">{file ?? "Comma, tab or semicolon separated. A header row is optional."}</p>
          <input
            ref={input}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              void take(e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </div>

        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setFile(null)
          }}
          rows={6}
          placeholder={"Jane Doe, jane@acme.org, Acme Corp\nJohn Smith <john@beta.io>\nbare@gamma.net"}
          className="font-mono text-xs"
        />

        {failed && <p className="text-sm text-destructive">{failed}</p>}

        {!!text.trim() && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-foreground">{count(read.fresh.length, "contact")} to add</span>
              {read.duplicates.length > 0 && <span className="text-muted-foreground">{count(read.duplicates.length, "duplicate")} skipped</span>}
              {read.skipped.length > 0 && <span className="text-destructive">{count(read.skipped.length, "row")} unreadable</span>}
              {read.total > 0 && <span className="ml-auto text-xs text-muted-foreground">{read.header ? "Columns read from the header row" : "No header row — columns read by shape"}</span>}
            </p>
            {read.skipped.length > 0 && (
              <ul className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
                {read.skipped.slice(0, 50).map((row: SkippedRow, i) => (
                  <li key={`${row.line}-${i}`} className="truncate">
                    <span className="tabular-nums">Line {row.line}</span> — {row.reason}: <span className="font-mono">{row.text || "(blank)"}</span>
                  </li>
                ))}
                {read.skipped.length > 50 && <li className="text-muted-foreground/70">…and {read.skipped.length - 50} more.</li>}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={commit} disabled={!read.fresh.length}>
            {read.fresh.length ? `Add ${count(read.fresh.length, "contact")}` : "Add contacts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------

export function InviteesPage() {
  const [rows, setRows] = useLocal<Invitee[]>(KEY, [])
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<InviteeStatus | "all">("all")
  const [page, setPage] = React.useState(1)

  const add = (contacts: ParsedContact[]) => {
    const day = today()
    setRows((previous) => {
      const held = new Set(previous.map((row) => row.email))
      return [...previous, ...contacts.filter((c) => !held.has(c.email)).map((c) => ({ ...c, status: "not-invited" as const, added: day }))]
    })
    setPage(1)
  }
  const setStatusOf = (email: string, next: InviteeStatus) => setRows((previous) => previous.map((row) => (row.email === email ? { ...row, status: next } : row)))
  const remove = (email: string) => setRows((previous) => previous.filter((row) => row.email !== email))

  const shown = React.useMemo(
    () => rows.filter((row) => (status === "all" || row.status === status) && matchesQuery(query, row.name, row.email, row.org)),
    [rows, query, status]
  )
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const current = Math.min(page, pages)
  const slice = shown.slice((current - 1) * PAGE, current * PAGE)

  const tally = (value: InviteeStatus) => rows.filter((row) => row.status === value).length
  const tiles: DbStat[] = [
    { title: "Contacts", value: rows.length },
    ...STATUSES.map((s) => ({ title: s.label, value: tally(s.value) })),
  ]

  return (
    <div>
      <PageTitle
        title="Invitees"
        endContent={
          <div className="flex items-center gap-2">
            {/* The send is not wired. When it is, this posts the whole list to
                Resend from an nysgpt.com address with the Clerk copied. */}
            <Button variant="outline" size="sm" className="gap-1.5" disabled title="Sending is not wired yet">
              <MailPlusIcon className="size-4" />
              Invite all
            </Button>
            <AddContacts existing={rows} onAdd={add} />
          </div>
        }
      />

      <div className="mt-4 sm:mt-5">
        <StatDatabaseGrid stats={tiles} />
      </div>

      <div className="mt-4 sm:mt-5">
        <Card className="gap-4">
          <CardHeader>
            <CardAnchor>Invitees</CardAnchor>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="rounded-lg border-l-2 border-primary bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Where this stands:</span> the list is held in this browser
              until the send step gives it a table of its own. Invitations will go out through Resend from an
              nysgpt.com address, copying the Clerk, so an invitee who replies reaches an agent that can onboard them.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative grow sm:max-w-xs">
                <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Search name, email or organization"
                  className="h-9 pl-8"
                />
              </div>
              <Select
                value={status}
                onValueChange={(value: unknown) => {
                  setStatus(String(value) as InviteeStatus | "all")
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 sm:w-40">
                  <SelectValue>{() => (status === "all" ? "All statuses" : statusOf(status).label)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!rows.length ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center">
                <p className="text-sm text-muted-foreground">Nobody on the list yet. Upload a CSV or paste a list of addresses.</p>
                <AddContacts existing={rows} onAdd={add} />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-10 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slice.map((row) => {
                      const badge = statusOf(row.status)
                      return (
                        <TableRow key={row.email}>
                          {/* A contact list is allowed to arrive without names; the
                              address stands in rather than an empty cell. */}
                          <TableCell className="font-medium whitespace-nowrap">{row.name || <span className="text-muted-foreground">{row.email}</span>}</TableCell>
                          <TableCell className="font-mono text-xs">{row.email}</TableCell>
                          <TableCell className="max-w-56 truncate">{row.org || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("h-5 gap-1", badge.tone)}>
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">{fmtAdded(row.added)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon-sm" aria-label={`Open menu for ${row.name || row.email}`}>
                                    <MoreHorizontalIcon />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end" className="w-max min-w-44">
                                {/* Stub. The send goes through Resend, from an
                                    nysgpt.com address, CC'ing the Clerk. */}
                                <DropdownMenuItem disabled className="whitespace-nowrap">
                                  <MailPlusIcon />
                                  Send invitation
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Mark as</DropdownMenuLabel>
                                {STATUSES.map((s) => (
                                  <DropdownMenuItem key={s.value} disabled={s.value === row.status} onClick={() => setStatusOf(row.email, s.value)} className="whitespace-nowrap">
                                    {s.label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => remove(row.email)} className="whitespace-nowrap">
                                  <Trash2Icon />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {!slice.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          Nobody matching &ldquo;{query.trim()}&rdquo;{status === "all" ? "" : ` under ${statusOf(status).label}`}.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{shown.length ? (current - 1) * PAGE + 1 : 0}</span> to{" "}
                    <span className="font-medium text-foreground">{Math.min(current * PAGE, shown.length)}</span> of{" "}
                    <span className="font-medium text-foreground">{shown.length}</span> results
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                      Previous
                    </Button>
                    {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                      const n = current <= 3 ? i + 1 : Math.min(pages - 4, current - 2) + i
                      return (
                        <Button key={n} variant={n === current ? "secondary" : "ghost"} size="sm" onClick={() => setPage(n)}>
                          {n}
                        </Button>
                      )
                    })}
                    <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
