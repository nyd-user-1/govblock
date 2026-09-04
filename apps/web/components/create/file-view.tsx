"use client"

import * as React from "react"
import { ExternalLinkIcon } from "lucide-react"

import type { Node, Target } from "@/lib/create/path"
import { designDiff, type Design } from "@/lib/create/preset"
import { partyName } from "@/lib/filters"
import { fmtDate, fmtNumber, honorific, truncate } from "@/lib/format"
import { portraitFor } from "@/lib/imagery"
import { useSessionTitle, type Scope } from "@/lib/policy/scope"
import type { Bill, BillRow, Member } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { commitVersion, useCommits } from "@/lib/policy/commits"
import { BillChanges } from "@/components/create/bill-changes"
import { BillEdit } from "@/components/create/bill-edit"
import { BillHistory } from "@/components/create/bill-history"
import { MemberRecord } from "@/components/create/member-record"
import { BillTextPane, type TextVersion } from "@/components/policy/bill-text-pane"
import { ChamberSeal, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/ny4/button"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"

// A record on the stage, with its tabs, the way GitHub gives a file Code and
// Blame. A bill: Text (the pane), Changes (its versions as a commit page),
// Record (its page), Typeset, and History (the versions as a commit list,
// reached by the History button rather than a pill, as on GitHub). A member:
// Record (their page), Bills (what they sponsored), Votes (how they voted).
// A roll call: the tally and every member's position.

function query(pairs: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(pairs)) if (value !== undefined && value !== null && value !== "") params.set(key, String(value))
  const text = params.toString()
  return text ? `?${text}` : ""
}

function Tabs({ tabs, active, onTab, trailing }: { tabs: { value: string; label: string }[]; active: string; onTab: (tab: string) => void; trailing?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
      <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
        {tabs.map((t) => (
          <button key={t.value} type="button" data-active={active === t.value} onClick={() => onTab(t.value)} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
            {t.label}
          </button>
        ))}
      </div>
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  )
}

const BILL_TABS = [
  { value: "text", label: "Text" },
  { value: "changes", label: "Changes" },
  { value: "record", label: "Record" },
  { value: "typeset", label: "Typeset" },
]
const MEMBER_TABS = [
  { value: "record", label: "Record" },
  { value: "bills", label: "Bills" },
  { value: "votes", label: "Votes" },
]

type RollCallAnswer = {
  rollCall: { roll_call_id: number; bill_id: number; date: string; chamber: string; description: string; yea: number; nay: number; nv: number; absent: number; total: number; bill_number: string; title: string }
  votes: { vote_desc: string; people_id: number; name: string; party: string; district: string; chamber: string; role: string; photo_url: string | null; bioguide_id: string | null }[]
}

type MemberRecordAnswer = { sponsored: (BillRow & { role: number })[]; counts: { sponsored: number } }

export function FileView({ node, scope, design, tab, doc, onTab, onDoc, onGo }: { node: Extract<Node, { kind: "bill" | "member" | "rollcall" }>; scope: Scope; design: Design; tab: string; doc: string; onTab: (tab: string) => void; onDoc: (documentId: number | null) => void; onGo: (go: Target) => void }) {
  const { state, session } = scope
  const sessionTitle = useSessionTitle(state, session)
  const sessionParam = scope.filters.session ? session : undefined

  const { data: bill } = usePolicy<Bill>(node.kind === "bill" ? "bill" : null, { state }, { id: node.kind === "bill" ? node.id : undefined })
  const { data: member } = usePolicy<Member>(node.kind === "member" ? "member" : null, { state, session: scope.filters.session }, { id: node.kind === "member" ? node.id : undefined })
  const { data: sponsored } = usePolicy<MemberRecordAnswer>(node.kind === "member" && tab === "bills" ? "record" : null, { state, session: scope.filters.session }, { id: node.kind === "member" ? node.id : undefined, limit: 100 })
  const { data: rollcall } = usePolicy<RollCallAnswer>(node.kind === "rollcall" ? "rollcall" : null, { state }, { id: node.kind === "rollcall" ? node.id : undefined })
  // One array per bill, newest first, so the tabs that key effects on it do
  // not re-run every render. The reader's own commits sit in it as versions,
  // newest first, ahead of the legislature's.
  const { commits, add: addCommit } = useCommits(state, node.kind === "bill" ? node.id : null)
  const versions = React.useMemo<TextVersion[]>(() => [...commits.map(commitVersion), ...[...(bill?.texts ?? [])].sort((a, b) => b.document_id - a.document_id)], [bill?.texts, commits])
  // The version being edited, and its text.
  const editing = node.kind === "bill" && tab === "edit"
  const editBase = editing ? (versions.find((v) => v.document_id === Number(doc)) ?? versions[0]) : undefined
  const { data: editDoc } = usePolicy<{ text?: string }>(editBase && !editBase.commit ? "text" : null, { state }, { id: node.kind === "bill" ? node.id : undefined, document: editBase?.document_id })

  if (node.kind === "bill") {
    const active = tab === "history" || tab === "edit" || BILL_TABS.some((t) => t.value === tab) ? tab : "text"
    const historyButton = (
      <Button variant="outline" size="sm" data-active={active === "history"} className="data-[active=true]:bg-muted" onClick={() => onTab("history")}>
        History{versions.length ? ` · ${versions.length}` : ""}
      </Button>
    )
    const openText = (documentId: number) => onGo({ bill: String(node.id), tab: "text", doc: String(documentId) })
    const openChanges = (documentId: number) => onGo({ bill: String(node.id), tab: "changes", doc: String(documentId) })
    const href = active === "record" ? `/docs/bills/${node.id}${query({ state })}` : active === "typeset" ? `/preview/typeset/docs${query({ state, session: sessionParam, bill: node.id, ...designDiff(design) })}` : null
    const related = [
      ...(bill?.sameAs ?? []).map((s) => ({ label: s.sast_bill_number, action: `View ${s.sast_type?.toLowerCase().includes("same") ? "companion bill" : s.sast_type || "related bill"}`, onClick: () => onGo({ bill: String(s.sast_bill_id) }) })),
      ...versions.filter((v) => /amend|engross|enroll|substitute|comm sub/i.test(v.version ?? "")).map((v) => ({ label: bill?.bill_number ?? "", action: `View ${v.version}`, onClick: () => onDoc(v.document_id) })),
    ]
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {active !== "text" && active !== "edit" && (
          // No tab pills (Brendan, 2026-09-03: "we have duplicates of it"):
          // the file's name in the path bar returns to the text, the ⋯ menu
          // opens any view, and History has its button.
          <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
            <div className="ml-auto flex items-center gap-2">
              {href && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={href} target="_blank" rel="noreferrer">
                    Open in new tab <ExternalLinkIcon className="size-3.5" />
                  </a>
                </Button>
              )}
              {historyButton}
            </div>
          </div>
        )}
        {active === "text" ? (
          bill ? (
            <BillTextPane
              state={state}
              session={session}
              sessionTitle={sessionTitle}
              bill={bill}
              versions={versions}
              current={doc ? Number(doc) : null}
              onChoose={(id) => onDoc(id)}
              onOpenBill={(billId, documentId) => {
                onGo({ bill: String(billId) })
                if (documentId) onDoc(documentId)
              }}
              history={historyButton}
              related={related}
              onEdit={() => onGo({ bill: String(node.id), tab: "edit", doc: doc || null })}
            />
          ) : (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
              ))}
            </div>
          )
        ) : active === "edit" && bill && editBase ? (
          <BillEdit
            bill={bill}
            base={editBase}
            baseText={editBase.commit?.text ?? editDoc?.text ?? null}
            onCancel={() => onGo({ bill: String(node.id), tab: null, doc: doc || null })}
            onCommit={({ message, description, text }) => {
              const made = addCommit({ parent: editBase.document_id, message, description, text })
              onGo({ bill: String(node.id), tab: null, doc: made ? String(made.id) : null })
            }}
          />
        ) : active === "changes" && bill ? (
          <BillChanges state={state} bill={bill} versions={versions} doc={doc ? Number(doc) : null} onDoc={(id) => onDoc(id)} onOpenText={openText} />
        ) : active === "history" && bill ? (
          <BillHistory bill={bill} versions={versions} onOpenText={openText} onOpenChanges={openChanges} />
        ) : active === "changes" || active === "history" ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
            ))}
          </div>
        ) : (
          <iframe key={href} src={href ?? undefined} title={`${bill?.bill_number ?? "Bill"} · ${active}`} className="min-h-0 flex-1 bg-background" />
        )}
      </div>
    )
  }

  if (node.kind === "rollcall") {
    const rc = rollcall?.rollCall
    const votes = rollcall?.votes ?? []
    const total = Math.max(1, (rc?.yea ?? 0) + (rc?.nay ?? 0))
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex shrink-0 flex-wrap items-start gap-4 border-b px-4 py-3">
          <ChamberSeal state={state} chamber={rc?.chamber} size={40} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium">{rc?.description ?? "Roll call"}</span>
            {rc && (
              <span className="text-xs text-muted-foreground">
                <button type="button" className="font-mono text-primary hover:underline" onClick={() => onGo({ bill: String(rc.bill_id), rollcall: null })}>
                  {rc.bill_number}
                </button>
                {" · "}
                {truncate(rc.title, 100)} · {rc.chamber} · {fmtDate(rc.date)}
              </span>
            )}
            {rc && (
              <span className="mt-1 flex h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
                <span className="h-full" style={{ width: `${(rc.yea / total) * 100}%`, background: "#16a34a" }} />
                <span className="h-full" style={{ width: `${(rc.nay / total) * 100}%`, background: "#dc2626" }} />
              </span>
            )}
            {rc && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {fmtNumber(rc.yea)} aye · {fmtNumber(rc.nay)} nay{rc.nv ? ` · ${fmtNumber(rc.nv)} not voting` : ""}{rc.absent ? ` · ${fmtNumber(rc.absent)} absent` : ""} · {fmtNumber(rc.total)} recorded
              </span>
            )}
          </div>
        </div>
        <div className="mx-4 my-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="w-32">Chamber</TableHead>
                <TableHead className="w-28">District</TableHead>
                <TableHead className="w-32">Party</TableHead>
                <TableHead className="w-28 text-right">Vote</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {votes.map((v) => (
                <TableRow key={v.people_id} className="cursor-pointer" onClick={() => onGo({ member: String(v.people_id), rollcall: null, bill: null })}>
                  <TableCell>
                    <span className="flex items-center gap-2.5 font-medium">
                      <span className="relative shrink-0">
                        <MemberPortrait name={v.name} photoUrl={portraitFor(v)} state={state} chamber={v.chamber} size={22} />
                        <PartyDot party={v.party} serving className="absolute -right-0.5 -bottom-0.5 size-2 ring-2 ring-card" />
                      </span>
                      {honorific(v.role, v.chamber)} {v.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.chamber}</TableCell>
                  <TableCell className="text-muted-foreground">{v.district?.replace(/^[A-Z]+-0*/, "") || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{partyName(v.party) || v.party}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={v.vote_desc === "Yea" ? "border-emerald-600/40 text-emerald-700" : v.vote_desc === "Nay" ? "border-red-600/40 text-red-700" : "font-normal text-muted-foreground"}>
                      {v.vote_desc === "Yea" ? "Aye" : v.vote_desc}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!votes.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {rollcall ? "No positions recorded for this roll call." : "Loading…"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  const active = MEMBER_TABS.some((t) => t.value === tab) ? tab : "record"
  const label = member ? `${honorific(member.role, member.chamber)} ${member.name}` : `Member ${node.id}`
  const href = `/docs/directory/${node.id}${query({ state })}`
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        {member ? (
          <span className="relative">
            <MemberPortrait name={member.name} photoUrl={portraitFor(member)} state={state} chamber={member.chamber} size={32} />
            <PartyDot party={member.party} serving className="absolute -right-0.5 -bottom-0.5 size-2.5 ring-2 ring-background" />
          </span>
        ) : (
          <ChamberSeal state={state} size={32} />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{label}</span>
          {member && <span className="truncate text-xs text-muted-foreground">{[member.chamber, member.district ? member.district.replace(/^[A-Z]+-0*/, "District ") : null, partyName(member.party), member.leadership_title ? truncate(member.leadership_title, 60) : null].filter(Boolean).join(" · ")}</span>}
        </div>
      </div>
      <Tabs
        tabs={MEMBER_TABS}
        active={active}
        onTab={onTab}
        trailing={
          active === "record" && (
            <Button variant="ghost" size="sm" asChild>
              <a href={href} target="_blank" rel="noreferrer">
                Open in new tab <ExternalLinkIcon className="size-3.5" />
              </a>
            </Button>
          )
        }
      />
      {active === "votes" ? (
        <MemberRecord id={node.id} scope={scope} label={label} />
      ) : active === "bills" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-4 my-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-36">Bill</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-44">Status</TableHead>
                  <TableHead className="w-48">Committee</TableHead>
                  <TableHead className="w-32 text-right">Last action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sponsored?.sponsored ?? []).map((b) => (
                  <TableRow key={b.bill_id} className="cursor-pointer" onClick={() => onGo({ bill: String(b.bill_id), rollcall: null })}>
                    <TableCell className="font-mono text-xs font-medium">{b.bill_number}</TableCell>
                    <TableCell className="max-w-0 truncate text-muted-foreground">{truncate(b.title, 110)}</TableCell>
                    <TableCell className="text-muted-foreground">{b.status_desc ?? "Introduced"}</TableCell>
                    <TableCell className="max-w-0 truncate text-muted-foreground">{b.committee ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{b.last_action_date ? fmtDate(b.last_action_date) : "—"}</TableCell>
                  </TableRow>
                ))}
                {!sponsored?.sponsored.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      {sponsored ? "No bills sponsored this session." : "Loading…"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <iframe key={href} src={href} title={`${label} · Record`} className="min-h-0 flex-1 bg-background" />
      )}
    </div>
  )
}
