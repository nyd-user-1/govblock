import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, honorific, truncate } from "@/lib/format"
import { ArrowUpRight } from "lucide-react"

import { hasSeal } from "@/lib/imagery"
import { ChamberSeal, PartyDot } from "@/components/policy/imagery"
import { MemberOffice, MemberOfficialPortrait } from "@/components/policy/member-congress"

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
  /** The bill's chamber, which decides which seal marks its entry. */
  body?: string | null
}

// The changelog's shape, which is the right one for this: what they put their
// name to and how they voted, newest first, each entry the bill.
export function MemberFeed({
  bills,
  empty,
  vote,
  total,
  state,
}: {
  bills: RecordBill[]
  empty: string
  vote?: "Aye" | "Nay"
  /** The whole record; the feed shows the most recent page of it. */
  total?: number
  /** The member's jurisdiction, which is the bills' jurisdiction too. */
  state: string
}) {
  if (!bills.length) {
    return <p className="py-10 text-sm text-muted-foreground">{empty}</p>
  }
  return (
    // Explicit rows rather than the .steps counter. Each entry needed three
    // things the counter cannot give it — a hover state, an arrow in its own
    // corner, and a marker that is a chamber seal rather than an ordinal — and
    // the number was never the point: which chamber a bill is in says more
    // than that it was the fourth one listed.
    <div className="not-typeset mt-6 mb-8 flex flex-col">
      {bills.map((bill, index) => (
        <Link
          key={bill.bill_id}
          href={`/docs/bills/${bill.bill_id}`}
          className="group relative flex gap-4 rounded-lg px-3 py-4 no-underline transition-colors hover:bg-muted/50 md:px-4"
        >
          <span className="shrink-0 pt-0.5">
            {hasSeal(state, bill.body) ? (
              <ChamberSeal state={state} chamber={bill.body} size={36} />
            ) : (
              // The ruled fallback: no seal on file, so the ordinal stays,
              // matching the numbered circle this list used to draw.
              <span className="flex size-9 items-center justify-center rounded-full bg-muted text-center font-mono text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
            )}
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-baseline gap-2 pr-6 text-base font-semibold text-foreground">
              {bill.bill_number}
              {bill.last_action && (
                <span className="min-w-0 truncate font-normal text-muted-foreground">
                  {truncate(bill.last_action, 90)}
                </span>
              )}
            </span>
            <span className="text-sm text-muted-foreground">
              {[
                bill.last_action_date ? fmtDate(bill.last_action_date) : null,
                bill.status_desc || "Introduced",
                bill.committee ? `${bill.committee} Committee` : null,
                vote ? `Voted ${vote}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span className="text-sm text-foreground">{truncate(bill.title, 240)}</span>
          </span>

          {/* The row has always linked to the bill; now it looks like it does. */}
          <ArrowUpRight
            aria-hidden
            className="absolute top-3 right-3 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          />
        </Link>
      ))}
      {typeof total === "number" && total > bills.length && (
        <p className="px-3 pt-2 text-sm text-muted-foreground md:px-4">
          Showing the {bills.length} most recent of {fmtNumber(total)}.
        </p>
      )}
    </div>
  )
}

export function MemberHeader({
  peopleId,
  state,
  member,
  action,
}: {
  peopleId: number
  state: string
  member: Record<string, unknown>
  /** The Copy Page control, so it top-aligns with the name as /docs/bills does. */
  action?: React.ReactNode
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
          {/* "Congress House" is not a thing anyone says. Every other
              jurisdiction reads "New York Assembly"; the federal one reads
              "U.S. House". */}
          <span>{state === "US" ? `U.S. ${chamber}` : `${stateName(state)} ${chamber}`}</span>
        </p>
        {/* The counts used to live here and are now on the Record pills, which
            is where someone looking for them goes. The office takes the space:
            it is the one thing about a member this page knew and never said. */}
        <MemberOffice />
      </div>
      {action && <div className="docs-nav hidden shrink-0 sm:block">{action}</div>}
      <span className="sr-only">{peopleId}</span>
    </header>
  )
}
