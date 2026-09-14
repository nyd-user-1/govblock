import "server-only"

import type { RollCallTallyProps } from "@/components/clips/templates/roll-call-tally"
import { one } from "@/lib/policy/db"
import { getRollCallSessions, getRollCalls, getRollCallVote, type Chamber } from "@/lib/policy/roll-call-queries"

// What a template is fed, read from the record by an id, the way a block is.
// The roll call tally takes a chamber, a congress, a session and a roll
// number; with none, the newest House roll call.

const YEA = new Set(["Yea", "Aye", "Yes", "Guilty"])
const NAY = new Set(["Nay", "No", "Not Guilty"])

const bucket = (cast: string) => (YEA.has(cast) ? "yea" : NAY.has(cast) ? "nay" : cast === "Present" ? "present" : "notVoting")

export type RollCallAddress = { chamber: Chamber; congress: number; session: number; roll: number }

export async function latestRollCall(chamber: Chamber = "house"): Promise<RollCallAddress | null> {
  const session = (await getRollCallSessions()).find((s) => s.chamber === chamber)
  if (!session) return null
  const { rows } = await getRollCalls(chamber, session.congress, session.session, 1)
  return rows[0] ? { chamber, congress: session.congress, session: session.session, roll: rows[0].roll } : null
}

/** The tally's props, plus the ids a clip of it is keyed to. */
export async function rollCallTallyProps(a: RollCallAddress) {
  const held = await getRollCallVote(a.chamber, a.congress, a.session, a.roll)
  if (!held) return null
  const { vote, positions } = held

  const counts = { yea: 0, nay: 0, present: 0, notVoting: 0 }
  const byParty = new Map<string, typeof counts>()
  for (const p of positions) {
    const b = bucket(p.vote_cast ?? "")
    counts[b]++
    const party = p.party ?? "—"
    const row = byParty.get(party) ?? { yea: 0, nay: 0, present: 0, notVoting: 0 }
    row[b]++
    byParty.set(party, row)
  }

  const bill = vote.congress_key ? await one<{ key: string; display_title: string | null }>(`select key, display_title from congress_bills where key = $1`, [vote.congress_key]) : null
  const key = await one<{ key: string }>(
    a.chamber === "senate"
      ? `select key from congress_senate_votes where congress = $1 and session_number = $2 and roll_call_number::int = $3`
      : `select key from congress_house_votes where congress = $1 and session_number = $2 and roll_call_number::int = $3`,
    [a.congress, String(a.session), a.roll]
  )

  const props: RollCallTallyProps = {
    chamber: a.chamber,
    congress: vote.congress,
    session: vote.session,
    roll: vote.roll,
    date: vote.date,
    citation: vote.citation,
    billTitle: bill?.display_title ?? vote.description ?? null,
    question: vote.question,
    result: vote.result,
    counts,
    parties: [...byParty.entries()]
      .map(([party, c]) => ({ party, ...c }))
      .sort((x, y) => y.yea + y.nay + y.present + y.notVoting - (x.yea + x.nay + x.present + x.notVoting)),
  }
  return { props, keys: { roll_call_chamber: a.chamber, roll_call_key: key?.key ?? null, bill_key: bill?.key ?? null } }
}
