"use client"

import * as React from "react"
import Link from "next/link"

import { fmtDate } from "@/lib/format"
import { Button } from "@govblock/ui/components/nova/button"
import { usePolicy } from "@/lib/policy/use-policy"
import { day } from "@/lib/policy/congress"
import { MemberPortrait } from "@/components/policy/imagery"
import { H2, Table } from "@/components/typeset"
import { DocsTableOfContents } from "@/components/docs-toc"

// What congress.gov holds about a member, on the member's own page: the
// official portrait, the terms served, the parties served under, the office
// and the website, and how they voted on the House floor.
//
// The portrait is the point of the first of those. Every federal portrait on
// this site came from clerk.house.gov, which has one for a representative and
// none at all for a senator — 107 of 553 members had no face. The bioguide's
// own depiction has all of them.

type Term = { chamber?: string; startYear?: number; endYear?: number | null; congress?: number; stateName?: string }
type Party = { partyName?: string; partyAbbreviation?: string; startYear?: number; endYear?: number | null }
type Detail = {
  member?: {
    depiction?: { imageUrl?: string; attribution?: string }
    terms?: { item?: Term[] } | Term[]
    partyHistory?: Party[]
    addressInformation?: { officeAddress?: string; city?: string; district?: string; zipCode?: number | string; phoneNumber?: string }
    officialWebsiteUrl?: string
    birthYear?: string
    honorificName?: string
  }
  portraitUrl?: string | null
}
type Vote = {
  identifier?: number | string
  rollCallNumber?: number
  sessionNumber?: number
  startDate?: string
  legislationType?: string
  legislationNumber?: string
  legislationUrl?: string
  voteQuestion?: string
  result?: string
  voteCast?: string
  /** Our own row for the bill, when the roll call names one we hold. */
  billId?: number | null
  title?: string | null
}

// The same roll call, spelled two ways: the API's own camelCase where the
// record came from congress.gov, and the column names where it came from the
// positions table. One shape reaches the table.
type RawVote = Record<string, unknown>
const pick = (row: RawVote, ...keys: string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null) return row[key]
  return undefined
}
const asVote = (row: RawVote): Vote => ({
  identifier: pick(row, "identifier", "vote_identifier") as Vote["identifier"],
  rollCallNumber: pick(row, "rollCallNumber", "roll_call_number") as number | undefined,
  sessionNumber: pick(row, "sessionNumber", "session_number") as number | undefined,
  startDate: pick(row, "startDate", "start_date") as string | undefined,
  legislationType: pick(row, "legislationType", "legislation_type") as string | undefined,
  legislationNumber: pick(row, "legislationNumber", "legislation_number") as string | undefined,
  legislationUrl: pick(row, "legislationUrl", "legislation_url") as string | undefined,
  voteQuestion: pick(row, "voteQuestion", "vote_question") as string | undefined,
  result: pick(row, "result") as string | undefined,
  voteCast: pick(row, "voteCast", "vote_cast") as string | undefined,
  billId: pick(row, "billId", "bill_id") as number | null | undefined,
  title: pick(row, "title") as string | null | undefined,
})

type Value = { detail: Detail | null; votes: Vote[]; onCongress: boolean; peopleId: number; state: string }
const Ctx = React.createContext<Value>({ detail: null, votes: [], onCongress: false, peopleId: 0, state: "US" })
const use = () => React.useContext(Ctx)

export function MemberCongressProvider({
  peopleId,
  bioguide,
  state,
  children,
}: {
  peopleId: number
  bioguide: string | null
  /** The member's own jurisdiction — the path names one person, and they sit
      in one legislature whoever is reading about them. */
  state: string
  children: React.ReactNode
}) {
  const on = state === "US" && !!bioguide
  const detail = usePolicy<Detail>(on ? "member-detail" : null, { state }, { bioguide: bioguide ?? undefined })
  // Aurora keys a member's positions by `people_id`; the committed record is
  // keyed by bioguide, because that is what congress.gov keys a member by.
  // Both are sent and each answer takes the one it knows.
  const votes = usePolicy<{ memberVotes?: RawVote[]; votes?: RawVote[] }>(
    on ? "member-votes" : null,
    { state },
    { member: peopleId, bioguide: bioguide ?? undefined }
  )
  const value = React.useMemo<Value>(
    () => ({
      detail: detail.data ?? null,
      votes: (votes.data?.memberVotes ?? votes.data?.votes ?? []).map(asVote),
      onCongress: on,
      peopleId,
      state,
    }),
    [detail.data, votes.data, on, peopleId, state]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

const terms = (detail: Detail | null): Term[] => {
  const item = detail?.member?.terms
  return Array.isArray(item) ? item : (item?.item ?? [])
}

/**
 * The face. The bioguide's portrait when the record has arrived, the roster's
 * own photo until then — `MemberPortrait` only mounts a remote image after
 * hydration, so the seal stands in rather than a broken frame.
 */
export function MemberOfficialPortrait({
  name,
  fallback,
  state,
  chamber,
  size = 80,
}: {
  name: string
  fallback: string | null
  state: string
  chamber: string | null
  size?: number
}) {
  const { detail } = use()
  const official = detail?.portraitUrl ?? detail?.member?.depiction?.imageUrl ?? null
  return <MemberPortrait name={name} photoUrl={official ?? fallback} state={state} chamber={chamber} size={size} />
}

/** Terms served, newest first. The party line that followed is gone (Brendan, 2026-09-05). */
export function MemberTerms() {
  const { detail } = use()
  const served = [...terms(detail)].sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0))
  if (!served.length) return null
  const span = (start?: number, end?: number | null) => `${start ?? "—"}–${end ?? "present"}`
  return (
    <>
      <H2>Terms</H2>
      <ul>
        {served.map((term, index) => (
          <li key={`${term.chamber}-${term.startYear}-${index}`}>
            {term.chamber ?? "—"}
            {term.stateName ? `, ${term.stateName}` : ""} · {span(term.startYear, term.endYear)}
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * The member's Washington office, as the record has it.
 *
 * Data, never prose: officeAddress, city, district and zipCode come from
 * congress.gov's member detail, and a member the record holds no address for —
 * every state legislator, today — renders nothing here rather than a plausible
 * building. The heading is a constant because it only ever appears above real
 * lines.
 */
export function MemberOffice() {
  const { detail } = use()
  const address = detail?.member?.addressInformation
  const street = address?.officeAddress?.trim()
  if (!street) return null

  const cityLine = [address?.city, [address?.district, address?.zipCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ")

  return (
    <address className="mt-1 text-sm leading-relaxed text-muted-foreground not-italic">
      <span className="block font-medium text-foreground">Washington, D.C. Office</span>
      <span className="block">{street}</span>
      {cityLine && <span className="block">{cityLine}</span>}
      {address?.phoneNumber && <span className="block">Phone: {address.phoneNumber}</span>}
    </address>
  )
}

/** What senate.gov says about a senator that congress.gov does not. */
export type SenateLines = {
  address: string | null
  phone: string | null
  contact_form: string | null
  website: string | null
  class: string | null
  leadership_position: string | null
}

// Senate classes stand for election on a six-year cycle: Class II in 2026,
// Class III in 2028, Class I in 2030, and so on.
const CLASS_BASE: Record<string, number> = { I: 2024, II: 2020, III: 2022 }
export function nextElection(cls: string | null | undefined, now = new Date().getFullYear()) {
  const key = String(cls ?? "").replace(/^class\s+/i, "").toUpperCase()
  const base = CLASS_BASE[key]
  if (!base) return null
  let year = base
  while (year < now) year += 6
  return year
}

/** The office, the telephone and the member's own site. */
export function MemberContact({ phone, bio, senate }: { phone: string | null; bio: string | null; senate?: SenateLines | null }) {
  const { detail } = use()
  const address = detail?.member?.addressInformation
  const website = detail?.member?.officialWebsiteUrl ?? senate?.website
  // congress.gov writes a senator's city and zip into officeAddress itself and
  // a representative's beside it; append the parts the street line lacks.
  const street = address?.officeAddress?.trim() ?? ""
  const tail = [address?.city, address?.district, address?.zipCode].filter((part) => part && !street.includes(String(part)))
  const office = [street, ...tail].filter(Boolean).join(", ") || senate?.address || ""
  const number = address?.phoneNumber ?? senate?.phone ?? phone
  const election = nextElection(senate?.class)
  if (!office && !number && !website && !bio && !senate) return null
  return (
    <>
      <H2>Contact</H2>
      <ul>
        {office && <li>{office}</li>}
        {number && <li>{number}</li>}
        {website && (
          <li>
            <a href={website} target="_blank" rel="noopener noreferrer">
              {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </li>
        )}
        {senate?.contact_form && senate.contact_form !== website && (
          <li>
            <a href={senate.contact_form} target="_blank" rel="noopener noreferrer">
              Contact form
            </a>
          </li>
        )}
        {bio && (
          <li>
            <a href={bio} target="_blank" rel="noopener noreferrer">
              Official biography
            </a>
          </li>
        )}
        {senate?.leadership_position && <li>{senate.leadership_position}</li>}
        {senate?.class && (
          <li>
            Senate {senate.class}
            {election ? ` · next election ${election}` : ""}
          </li>
        )}
      </ul>
    </>
  )
}

/** How they voted on the House floor, roll call by roll call, newest first. */
const PAGE = 10

export function MemberVotes() {
  const { votes, onCongress, peopleId, state } = use()
  // Ten at a time, as the Bills and Votes lists above (Brendan, 2026-09-05).
  // The provider loads the first five hundred; past those, the next ten come
  // from the route with an offset.
  const [extra, setExtra] = React.useState<Vote[]>([])
  const [visible, setVisible] = React.useState(PAGE)
  const [busy, setBusy] = React.useState(false)
  const [exhausted, setExhausted] = React.useState(false)
  const all = React.useMemo(
    () => [...votes, ...extra].sort((a, b) => day(b.startDate).localeCompare(day(a.startDate))),
    [votes, extra]
  )
  if (!onCongress || !all.length) return null
  const more = !exhausted && !busy && (visible < all.length || votes.length >= 500)

  async function seeMore() {
    if (visible + PAGE <= all.length) {
      setVisible((v) => v + PAGE)
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/policy/member-votes?state=${encodeURIComponent(state)}&member=${peopleId}&limit=${PAGE}&offset=${all.length}`)
      const data = (await res.json()) as { memberVotes?: RawVote[] }
      const next = (data.memberVotes ?? []).map(asVote)
      if (next.length < PAGE) setExhausted(true)
      setExtra((prev) => [...prev, ...next])
      setVisible((v) => v + PAGE)
    } catch {
      setExhausted(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <H2>Roll calls</H2>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Roll call</th>
            <th>Bill</th>
            <th>Position</th>
            <th className="pr-10">Result</th>
          </tr>
        </thead>
        <tbody>
          {all.slice(0, visible).map((vote) => {
            const number = vote.legislationNumber ? `${vote.legislationType ?? ""} ${vote.legislationNumber}`.trim() : null
            return (
              <tr key={vote.identifier ?? `${vote.sessionNumber}-${vote.rollCallNumber}`}>
                <td className="whitespace-nowrap">{vote.startDate ? fmtDate(vote.startDate) : "—"}</td>
                <td className="whitespace-nowrap tabular-nums">{vote.rollCallNumber ?? "—"}</td>
                <td>
                  {/* The bill on its own page when we hold it, at congress.gov
                      when we don't, and the question itself when the roll call
                      named no bill — the Speaker's election, a quorum call. */}
                  {number && vote.billId ? (
                    <Link href={`/docs/bills/${vote.billId}`} className="whitespace-nowrap">
                      {number}
                    </Link>
                  ) : number && vote.legislationUrl ? (
                    <a href={vote.legislationUrl} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap">
                      {number}
                    </a>
                  ) : (
                    <span className={number ? "whitespace-nowrap" : undefined}>{number ?? vote.voteQuestion ?? "—"}</span>
                  )}
                </td>
                <td>{vote.voteCast ?? "—"}</td>
                <td className="pr-10">{vote.result?.replace(/^Agreed to$/, "Agreed") ?? "—"}</td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      {(more || busy) && (
        <p className="not-typeset mt-3">
          <Button variant="outline" size="sm" onClick={seeMore} disabled={busy}>
            {busy ? "Loading…" : "See more"}
          </Button>
        </p>
      )}
    </>
  )
}

/** The rail's contents, naming only the sections this member has. */
export function MemberToc({
  base,
  contact,
  offices = false,
  staff = false,
  biography,
}: {
  base: readonly string[]
  contact: boolean
  offices?: boolean
  staff?: boolean
  biography: boolean
}) {
  const { detail, votes } = use()
  const toc = React.useMemo(() => {
    const titles = [...base]
    if (terms(detail).length) titles.push("Terms")
    if (votes.length) titles.push("Roll calls")
    if (contact || detail?.member?.addressInformation || detail?.member?.officialWebsiteUrl) titles.push("Contact")
    // Offices and Staff sit under Contact, as shadcn's docs nest a command's
    // sub-commands: depth 3, indented in the rail.
    const under = new Set<string>()
    if (offices) { titles.push("Offices"); under.add("Offices") }
    if (staff) { titles.push("Staff"); under.add("Staff") }
    if (biography) titles.push("Biography")
    return titles.map((title) => ({ title, url: `#${title.replace(/\s+/g, "-").toLowerCase()}`, depth: under.has(title) ? 3 : 2 }))
  }, [base, contact, offices, staff, biography, detail, votes])
  return <DocsTableOfContents toc={toc} />
}
