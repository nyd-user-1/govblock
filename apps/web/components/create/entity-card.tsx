"use client"

import Link from "next/link"

import { memberHref, partyName } from "@/lib/filters"
import { fmtDate, fmtNumber, honorific, truncate } from "@/lib/format"
import { portraitFor } from "@/lib/imagery"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { ChamberSeal, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/button"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"

// The one component /create composes: a large card, in three versions. Same
// shape every time — media, title, one line of meta, a footer button — and the
// ⋮ menu with everything the home cards carry.

export type Bill = {
  bill_id: number
  bill_number: string
  title: string
  description?: string | null
  status_desc?: string | null
  last_action_date?: string | null
  committee?: string | null
  body?: string | null
  sponsor?: string | null
  sponsor_party?: string | null
}
export type Member = { people_id: number; name: string; party: string; role: string; chamber: string; district?: string | null; photo_url?: string | null; bioguide_id?: string | null; leadership_title?: string | null; active?: boolean }
export type Committee = { committee_name: string; chamber: string; bills: number }

function Shell({ id, media, title, description, meta, href, action, children }: { id: string; media: React.ReactNode; title: string; description?: string; meta?: string; href: string; action: string; children?: React.ReactNode }) {
  return (
    <CardFrame id={id} className="h-full">
      <CardHeader>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center gap-4 text-center">
        <div className="flex size-40 items-center justify-center rounded-2xl bg-muted/60">{media}</div>
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-lg text-balance">{title}</CardTitle>
          {description && <CardDescription className="text-pretty">{description}</CardDescription>}
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        </div>
        {children}
      </CardContent>
      <CardFooter className="border-t">
        <Button variant="secondary" className="w-full" nativeButton={false} render={<Link href={href} />}>
          {action}
        </Button>
      </CardFooter>
    </CardFrame>
  )
}

export function BillCard({ bill, state }: { bill: Bill; state: string }) {
  return (
    <Shell
      id={`bill-${bill.bill_id}`}
      media={<ChamberSeal state={state} chamber={bill.body} size={96} />}
      title={`${bill.bill_number} · ${truncate(bill.title, 90)}`}
      description={bill.description && bill.description !== bill.title ? truncate(bill.description, 140) : undefined}
      meta={[bill.status_desc || "Introduced", bill.last_action_date ? fmtDate(bill.last_action_date) : null, bill.committee, bill.sponsor].filter(Boolean).join(" · ")}
      href={`/docs/bills/${bill.bill_id}`}
      action="Open Bill"
    />
  )
}

export function MemberCard({ member, state }: { member: Member; state: string }) {
  return (
    <Shell
      id={`member-${member.people_id}`}
      media={
        <span className="relative">
          <MemberPortrait name={member.name} photoUrl={portraitFor(member)} state={state} chamber={member.chamber} size={96} />
          <PartyDot party={member.party} serving={member.active ?? true} className="absolute right-1 bottom-1 size-3 ring-2 ring-card" />
        </span>
      }
      title={`${honorific(member.role, member.chamber)} ${member.name}`}
      description={[member.chamber, member.district ? member.district.replace(/^[A-Z]+-0*/, "District ") : null, partyName(member.party)].filter(Boolean).join(" · ")}
      meta={member.leadership_title ?? undefined}
      href={memberHref(member.people_id, state)}
      action="Open Member"
    />
  )
}

export function CommitteeCard({ committee, state }: { committee: Committee; state: string }) {
  return (
    <Shell
      id={`committee-${committee.chamber}-${committee.committee_name}`}
      media={<ChamberSeal state={state} chamber={committee.chamber} size={96} />}
      title={committee.committee_name}
      description={`${committee.chamber} committee`}
      meta={`${fmtNumber(committee.bills)} bills before it`}
      href={`/docs/bills?state=${state}&committee=${encodeURIComponent(committee.committee_name)}`}
      action="Open Committee"
    />
  )
}
