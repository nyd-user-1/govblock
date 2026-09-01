import * as React from "react"
import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, honorific, truncate } from "@/lib/format"
import { PartyDot } from "@/components/policy/imagery"
import { MemberOfficialPortrait } from "@/components/policy/member-congress"

// Ported from livingston-v3 components/policy/member-page.tsx. There was no
// member page: every surface that named a member stopped at the name. This is
// where they all point now — `memberHref` has been writing /docs/directory/<id>
// since the directory landed, and until today it went nowhere.
//
// Server components, deliberately, as in v3: the path names exactly one
// person, so a shared link, a crawler and a reader with slow JS all see who it
// is. The portrait and the tabs are the client pieces.

type RecordBill = {
  bill_id: number
  bill_number: string
  title: string
  status_desc?: string | null
  last_action?: string | null
  last_action_date?: string | null
  committee?: string | null
}

export type MemberCounts = { sponsored: number; aye: number; nay: number }

// The changelog's shape, which is the right one for this: what they put their
// name to and how they voted, newest first, each entry the bill.
export function MemberFeed({
  bills,
  empty,
  vote,
  total,
}: {
  bills: RecordBill[]
  empty: string
  vote?: "Aye" | "Nay"
  /** The whole record; the feed shows the most recent page of it. */
  total?: number
}) {
  if (!bills.length) {
    return <p className="py-10 text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <div className="steps mb-8 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step">
      {bills.map((bill) => (
        <React.Fragment key={bill.bill_id}>
          <h3 id={String(bill.bill_number)} className="scroll-mt-24">
            <Link href={`/docs/bills/${bill.bill_id}`} className="no-underline hover:underline">
              {bill.bill_number}
            </Link>
            {bill.last_action ? ` — ${truncate(bill.last_action, 90)}` : ""}
          </h3>
          <p>
            {[
              bill.last_action_date ? fmtDate(bill.last_action_date) : null,
              bill.status_desc || "Introduced",
              bill.committee ? `${bill.committee} Committee` : null,
              vote ? `Voted ${vote}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p>{truncate(bill.title, 240)}</p>
        </React.Fragment>
      ))}
      {typeof total === "number" && total > bills.length && (
        <p className="text-sm text-muted-foreground">
          Showing the {bills.length} most recent of {fmtNumber(total)}.
        </p>
      )}
    </div>
  )
}

export function MemberHeader({
  peopleId,
  state,
  session,
  member,
  counts,
}: {
  peopleId: number
  state: string
  session: number
  member: Record<string, unknown>
  counts: MemberCounts
}) {
  const name = String(member.name ?? "")
  const role = String(member.role ?? "")
  const chamber = String(member.chamber ?? "")
  const party = member.party ? String(member.party) : null
  const leadership = member.leadership_title ? String(member.leadership_title) : null
  const district = member.district ? String(member.district).replace(/^[A-Z]+-0*/, "District ") : null

  return (
    <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:gap-6">
      <MemberOfficialPortrait
        name={name}
        fallback={member.photo_url ? String(member.photo_url) : null}
        state={state}
        chamber={chamber}
        size={80}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {honorific(role, chamber)} {name}
        </h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {leadership && (
            <>
              <span className="font-medium text-foreground">{leadership}</span>
              <span>•</span>
            </>
          )}
          {district && (
            <>
              <span>{district}</span>
              <span>•</span>
            </>
          )}
          <span className="inline-flex items-center gap-1.5">
            <PartyDot party={party} />({party ?? "—"})
          </span>
          <span>•</span>
          <span>
            {stateName(state)} {chamber}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {fmtNumber(counts.sponsored)} sponsored · {fmtNumber(counts.aye)} aye · {fmtNumber(counts.nay)} nay in the{" "}
          {session} session
        </p>
      </div>
      <span className="sr-only">{peopleId}</span>
    </header>
  )
}
