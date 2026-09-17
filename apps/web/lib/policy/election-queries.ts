import "server-only"

import { q } from "@/lib/policy/db"

// A member's elections (member_elections, sql/030; loaded by
// scripts/elections/load.mjs members): every general and primary the sources
// hold for them — Klarner's state legislative returns 2008–2022 and the FEC's
// House and Senate results 2008–2022. Read through the site's read cache.

export type MemberElection = {
  year: number
  state: string
  office: string
  district: string
  stage: "GEN" | "PRI"
  party: string | null
  votes: number | null
  share: number | null
  won: boolean | null
  incumbent: boolean | null
  unopposed: boolean | null
  opponents: { name: string; party: string | null; votes: number | null }[]
}

export async function getMemberElections(peopleId: number): Promise<MemberElection[]> {
  const rows = await q<Record<string, unknown>>(
    `select year, state, office, district, stage, party, votes, share, won, incumbent, unopposed, opponents::text as opponents
       from member_elections where people_id = $1
      order by year desc, case stage when 'GEN' then 0 else 1 end`,
    [peopleId]
  )
  const bool = (v: unknown) => (v === null || v === undefined ? null : v === true || v === "true")
  return rows.map((r) => ({
    year: Number(r.year),
    state: String(r.state),
    office: String(r.office),
    district: String(r.district ?? ""),
    stage: r.stage === "PRI" ? "PRI" : "GEN",
    party: r.party ? String(r.party) : null,
    votes: r.votes === null || r.votes === undefined ? null : Number(r.votes),
    share: r.share === null || r.share === undefined ? null : Number(r.share),
    won: bool(r.won),
    incumbent: bool(r.incumbent),
    unopposed: bool(r.unopposed),
    opponents: JSON.parse(String(r.opponents ?? "[]")),
  }))
}
