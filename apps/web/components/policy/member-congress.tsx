"use client"

import * as React from "react"

import { fmtDate, fmtNumber } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
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
})

type Value = { detail: Detail | null; votes: Vote[]; onCongress: boolean }
const Ctx = React.createContext<Value>({ detail: null, votes: [], onCongress: false })
const use = () => React.useContext(Ctx)

export function MemberCongressProvider({
  peopleId,
  bioguide,
  children,
}: {
  peopleId: number
  bioguide: string | null
  children: React.ReactNode
}) {
  const { state, resolved } = useJurisdiction()
  const on = resolved && state === "US" && !!bioguide
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
    }),
    [detail.data, votes.data, on]
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

/** Terms served, and the parties served under. */
export function MemberTerms() {
  const { detail } = use()
  const served = terms(detail)
  const parties = detail?.member?.partyHistory ?? []
  if (!served.length && !parties.length) return null
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
      {parties.length > 0 && (
        <p>
          {parties
            .map((party) => `${party.partyName ?? party.partyAbbreviation ?? "—"} ${span(party.startYear, party.endYear)}`)
            .join(" · ")}
        </p>
      )}
    </>
  )
}

/** The office, the telephone and the member's own site. */
export function MemberContact({ phone, bio }: { phone: string | null; bio: string | null }) {
  const { detail } = use()
  const address = detail?.member?.addressInformation
  const website = detail?.member?.officialWebsiteUrl
  const office = [address?.officeAddress, address?.city, address?.district, address?.zipCode].filter(Boolean).join(", ")
  const number = address?.phoneNumber ?? phone
  if (!office && !number && !website && !bio) return null
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
        {bio && (
          <li>
            <a href={bio} target="_blank" rel="noopener noreferrer">
              Official biography
            </a>
          </li>
        )}
      </ul>
    </>
  )
}

/** How they voted on the House floor, newest first. */
export function MemberVotes() {
  const { votes, onCongress } = use()
  if (!onCongress || !votes.length) return null
  return (
    <>
      <H2>Votes</H2>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Roll call</th>
            <th>Question</th>
            <th>Position</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {[...votes]
            .sort((a, b) => day(b.startDate).localeCompare(day(a.startDate)))
            .map((vote) => (
              <tr key={vote.identifier ?? `${vote.sessionNumber}-${vote.rollCallNumber}`}>
                <td>{vote.startDate ? fmtDate(vote.startDate) : "—"}</td>
                <td>
                  {vote.legislationUrl ? (
                    <a href={vote.legislationUrl} target="_blank" rel="noopener noreferrer">
                      {vote.legislationType} {vote.legislationNumber}
                    </a>
                  ) : (
                    `Roll ${vote.rollCallNumber ?? "—"}`
                  )}
                </td>
                <td>{vote.voteQuestion ?? "—"}</td>
                <td>{vote.voteCast ?? "—"}</td>
                <td>{vote.result ?? "—"}</td>
              </tr>
            ))}
        </tbody>
      </Table>
      <p>
        {fmtNumber(votes.length)} recorded {votes.length === 1 ? "position" : "positions"} on the roll calls on file.
      </p>
    </>
  )
}

/** Said once, when the reader is somewhere else. */
export function MemberFederalNote() {
  const { state, resolved } = useJurisdiction()
  if (!resolved || state === "US") return null
  return (
    <p className="text-sm text-muted-foreground">
      The portrait, terms, office and floor votes on this page are federal records. They read under the federal
      jurisdiction.
    </p>
  )
}

/** The rail's contents, naming only the sections this member has. */
export function MemberToc({
  base,
  contact,
  biography,
}: {
  base: readonly string[]
  contact: boolean
  biography: boolean
}) {
  const { detail, votes } = use()
  const toc = React.useMemo(() => {
    const titles = [...base]
    if (terms(detail).length || (detail?.member?.partyHistory ?? []).length) titles.push("Terms")
    if (votes.length) titles.push("Votes")
    if (contact || detail?.member?.addressInformation || detail?.member?.officialWebsiteUrl) titles.push("Contact")
    if (biography) titles.push("Biography")
    return titles.map((title) => ({ title, url: `#${title.replace(/\s+/g, "-").toLowerCase()}`, depth: 2 }))
  }, [base, contact, biography, detail, votes])
  return <DocsTableOfContents toc={toc} />
}
