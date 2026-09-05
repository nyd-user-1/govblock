import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { honorific } from "@/lib/format"

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


// "Rep. Alma Adams (D) has represented North Carolina's 12th Congressional
// District for seven terms. This session, Rep. Adams has sponsored 26 bills,
// co-sponsored 341 bills, voted Yes 249 times, and No 226 times." — Brendan's
// sentence (2026-09-05), every value derived: the seat from the district, the
// terms from congress.gov, the counts from this session's record.

const ORDINAL = (n: number) => {
  const rem = n % 100
  const suffix = rem >= 11 && rem <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")
  return `${n}${suffix}`
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]
const inWords = (n: number) => WORDS[n] ?? String(n)

/** "North Carolina's 12th Congressional District", "New York in the U.S. Senate", "New York's 25th Senate District". */
function seat(state: string, chamber: string, district: string | null) {
  // A Congress seat's state is in the district code (HD-NC-12), not the
  // jurisdiction, which is "US".
  const m = String(district ?? "").match(/^([A-Z]+)-([A-Z]{2})(?:-0*(\d+))?$/)
  const place = stateName(m?.[2] ?? state)
  const n = m?.[3] ? Number(m[3]) : null
  if (state === "US") {
    if (chamber === "Senate") return `${place} in the U.S. Senate`
    return n ? `${place}'s ${ORDINAL(n)} Congressional District` : `${place}'s at-large Congressional District`
  }
  return n ? `${place}'s ${ORDINAL(n)} ${chamber} District` : `${place} in the ${chamber}`
}

/** Terms in the current chamber: congress.gov lists one entry per Congress, and a Senate term is three. */
function termsServed(terms: { chamber?: string; startYear?: number }[], chamber: string) {
  const inChamber = terms.filter((t) => (chamber === "Senate" ? /senate/i.test(t.chamber ?? "") : /house/i.test(t.chamber ?? "")))
  if (!inChamber.length) return null
  return chamber === "Senate" ? Math.ceil(inChamber.length / 3) : inChamber.length
}

export function MemberIntroduction({
  member,
  state,
  career,
  terms,
}: {
  member: Record<string, unknown>
  state: string
  /** Totals across every session we hold, with where our record begins. */
  career: { prime: number; cosponsor: number; aye: number; nay: number; first_session: number | null; floor_session: number | null }
  terms: { chamber?: string; startYear?: number }[]
}) {
  const counts = career
  const name = String(member.name ?? "")
  const chamber = String(member.chamber ?? "")
  const title = honorific(String(member.role ?? ""), chamber)
  const party = member.party ? ` (${String(member.party)})` : ""
  const served = termsServed(terms, chamber)
  const surname = String(member.last_name ?? name.split(" ").slice(-1)[0] ?? "")
  const tenure = served
    ? `has represented ${seat(state, chamber, member.district ? String(member.district) : null)} for ${inWords(served)} ${served === 1 ? "term" : "terms"}`
    : `represents ${seat(state, chamber, member.district ? String(member.district) : null)}`
  // "In that time" is honest only when the whole tenure is on file. Our record
  // of Congress begins with the 111th (2009); a member who arrived before it
  // gets "Since 2009", and a state seat, with no terms to count, gets the
  // first session they appear in.
  const firstTerm = terms.reduce<number | null>((min, t) => (t.startYear != null && (min == null || t.startYear < min) ? t.startYear : min), null)
  const floor = career.floor_session
  const whole = served != null && firstTerm != null && floor != null && firstTerm >= floor
  const since = whole ? null : (served != null ? floor : career.first_session) ?? floor
  const span = whole ? "In that time" : since ? `Since ${since}` : "On the record"
  return (
    <p>
      {title} {name}
      {party} {tenure}. {span}, {title} {surname} has sponsored {fmtNumber(counts.prime)} {counts.prime === 1 ? "bill" : "bills"}, co-sponsored{" "}
      {fmtNumber(counts.cosponsor)} {counts.cosponsor === 1 ? "bill" : "bills"}, voted Yes {fmtNumber(counts.aye)} {counts.aye === 1 ? "time" : "times"}, and No{" "}
      {fmtNumber(counts.nay)} {counts.nay === 1 ? "time" : "times"}.
    </p>
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
    <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:gap-6">
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
      </div>
      {action && <div className="docs-nav hidden shrink-0 sm:block">{action}</div>}
      <span className="sr-only">{peopleId}</span>
    </header>
  )
}
