"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { fmtBill, fmtDate, fmtNumber } from "@/lib/format"
import { stateName } from "@/lib/filters"
import { districtLabel, legislativeBody } from "@/lib/legislative-body"
import { portraitFor } from "@/lib/imagery"
import { usePolicy } from "@/lib/policy/use-policy"
import { FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { LoadingFlag } from "@/components/loading-flag"
import type { BlockRecord, BlockSpec } from "@/lib/blocks"
import { Button } from "@govblock/ui/components/nova/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"

// A block's record, opened where it stands (Brendan, 2026-09-22: "clicking on
// the bill block on the home page opens the block's detail page in a dialogue").
// The record's page carries far more than a dialog should — the text, the
// votes, the committees, the whole journey — so this is its head and its facts:
// what the page opens on, in the order the page opens them, with the way
// through to the page itself at the foot. A reader who wants the rest presses
// it; a reader checking where a bill stands never leaves their home page.

type Bill = {
  bill_number: string
  title: string
  description?: string | null
  status_desc?: string | null
  last_action?: string | null
  last_action_date?: string | null
  committee?: string | null
  body?: string | null
  sponsor?: string | null
  sponsor_party?: string | null
  session_title?: string | null
  state: string
}
type Member = {
  name: string
  party: string
  role: string
  chamber: string
  district: string
  state: string
  photo_url?: string | null
  bioguide_id?: string | null
  email?: string | null
  bio_long?: string | null
  prime?: number
  cosponsor?: number
}
type Committee = { bills?: { bill_id: number; bill_number: string; title: string; state: string; status_desc?: string | null }[]; hearings?: unknown[] }

/** A fact, as the record pages set them: the label quiet, the value plain. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

export function BlockDialog({
  spec,
  record,
  open,
  onOpenChange,
}: {
  spec: BlockSpec
  record: BlockRecord
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pick = spec.pick
  const { data, isLoading } = usePolicy<unknown>(open && pick ? pick.resource : null, { state: record.state }, { [pick?.param ?? "id"]: record.id })
  const href = pick ? pick.href(record) : spec.href(record.state)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] w-[min(44rem,92vw)] overflow-y-auto">
        {isLoading && data === undefined ? (
          <div className="flex justify-center py-12">
            <LoadingFlag width={36} />
          </div>
        ) : pick?.kind === "bills" ? (
          <BillDetail bill={data as Bill | undefined} record={record} />
        ) : pick?.kind === "members" ? (
          <MemberDetail member={data as Member | undefined} record={record} />
        ) : (
          <CommitteeDetail committee={data as Committee | undefined} record={record} />
        )}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" render={<Link href={href} />} nativeButton={false}>
            Open the page <ArrowUpRight />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function BillDetail({ bill, record }: { bill: Bill | undefined; record: BlockRecord }) {
  if (!bill) return <p className="py-8 text-center text-sm text-muted-foreground">Not on file.</p>
  const number = fmtBill(bill.bill_number, bill.state ?? record.state)
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <FlagChip state={bill.state ?? record.state} width={28} />
          <span>{number}</span>
          {bill.status_desc && <span className="text-base font-normal text-muted-foreground">{bill.status_desc}</span>}
        </DialogTitle>
        <DialogDescription className="text-base text-foreground">{bill.title}</DialogDescription>
      </DialogHeader>
      {bill.description && bill.description.trim() !== bill.title.trim() && (
        <p className="text-sm text-muted-foreground">{bill.description}</p>
      )}
      <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
        <Fact label="Jurisdiction">{stateName(bill.state ?? record.state)}</Fact>
        <Fact label="Session">{bill.session_title}</Fact>
        <Fact label="Chamber">{bill.body}</Fact>
        <Fact label="Committee">{bill.committee}</Fact>
        <Fact label="Sponsor">{[bill.sponsor, bill.sponsor_party].filter(Boolean).join(" · ")}</Fact>
        <Fact label="Latest action">{bill.last_action_date ? fmtDate(bill.last_action_date) : null}</Fact>
      </div>
      {bill.last_action && (
        <div className="border-t pt-4">
          <p className="text-xs font-medium text-muted-foreground">What happened last</p>
          <p className="mt-1 text-sm">{bill.last_action}</p>
        </div>
      )}
    </>
  )
}

function MemberDetail({ member, record }: { member: Member | undefined; record: BlockRecord }) {
  if (!member) return <p className="py-8 text-center text-sm text-muted-foreground">Not on file.</p>
  const state = member.state ?? record.state
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <span className="relative shrink-0">
            <MemberPortrait name={member.name} photoUrl={portraitFor(member)} state={state} chamber={member.chamber} size={40} />
            <PartyDot party={member.party} className="absolute right-0 bottom-0 ring-2 ring-background" />
          </span>
          <span>{member.name}</span>
        </DialogTitle>
        <DialogDescription>{[legislativeBody(state, member.chamber), districtLabel(state, member.district)].filter(Boolean).join(" · ")}</DialogDescription>
      </DialogHeader>
      {member.bio_long && <p className="line-clamp-4 text-sm text-muted-foreground">{member.bio_long}</p>}
      <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
        <Fact label="Jurisdiction">{stateName(state)}</Fact>
        <Fact label="Role">{member.role}</Fact>
        <Fact label="Party">{member.party}</Fact>
        <Fact label="Sponsored">{fmtNumber(member.prime ?? 0)}</Fact>
        <Fact label="Cosponsored">{fmtNumber(member.cosponsor ?? 0)}</Fact>
        <Fact label="Email">{member.email}</Fact>
      </div>
    </>
  )
}

function CommitteeDetail({ committee, record }: { committee: Committee | undefined; record: BlockRecord }) {
  const rows = committee?.bills ?? []
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <FlagChip state={record.state} width={28} />
          <span>{record.label}</span>
        </DialogTitle>
        <DialogDescription>
          {fmtNumber(rows.length)} bills before it in {stateName(record.state)}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col divide-y border-t">
        {rows.slice(0, 8).map((bill) => (
          <Link key={bill.bill_id} href={`/bills/${bill.bill_id}?state=${bill.state ?? record.state}`} className="flex items-baseline gap-2 py-2 text-sm no-underline">
            <span className="shrink-0 font-medium">{fmtBill(bill.bill_number, bill.state ?? record.state)}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{bill.title}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
