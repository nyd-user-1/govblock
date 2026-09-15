import "server-only"

import type { BillHistoryProps } from "@/components/clips/templates/bill-history"
import type { RollCallTallyProps } from "@/components/clips/templates/roll-call-tally"
import { fmtBill } from "@/lib/format"
import { one } from "@/lib/policy/db"
import { getBill } from "@/lib/policy/db-queries"
import { getRollCallSessions, getRollCalls, getRollCallVote, type Chamber } from "@/lib/policy/roll-call-queries"

// What a template is fed, read from the record by an id, the way a block is.
// The roll call tally takes a chamber, a congress, a session and a roll
// number; with none, the newest House roll call. The bill history takes a
// bill's id, as its page's address carries it.

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

// ------------------------------------------------------------ bill history ---

/** The kinds of action a bill's history is told by, in the clerk's words across legislatures. Amendment traffic is left out. */
const MILESTONES: { kind: string; test: RegExp }[] = [
  { kind: "introduced", test: /^(introduced|prefiled|pre-filed|read first time|first reading)/i },
  { kind: "referred", test: /^referred to/i },
  { kind: "reported", test: /\breported\b|do pass|favorabl/i },
  { kind: "passed", test: /\b(passed|adopted)\b|agreed to by the yeas and nays|on passage .*agreed|third reading.*(passed|adopted)/i },
  { kind: "resolving", test: /^resolving differences|concurr(ed|ence) in|agreed to (the )?(senate|house|assembly) amendment/i },
  { kind: "presented", test: /presented to (the )?(president|governor)|delivered to governor|sent to governor/i },
  { kind: "signed", test: /signed by (the )?(president|governor)|approved by (the )?governor/i },
  { kind: "vetoed", test: /\bvetoed\b/i },
  { kind: "law", test: /became (public|private) law|chaptered|chapter \d+|enacted/i },
]

const AMENDMENT = /^(s|h)\.?\s?amdt|^amendment\b|\bamendment (sa|ha) \d/i

/** An action as the clerk wrote it, without its Congressional Record references and roll numbers in parentheses. */
const actionText = (action: string) => {
  const trimmed = action.replace(/\s*\((consideration: |text: )?CR [^)]*\)/g, "").replace(/\s*\(Roll no\.? ?\d+\)/gi, "").replace(/\s+/g, " ").trim()
  return trimmed.length > 220 ? `${trimmed.slice(0, 220).replace(/\s+\S*$/, "")}…` : trimmed
}

export async function billHistoryProps(billId: number) {
  const bill = await getBill(billId)
  if (!bill) return null
  const picked: { date: string; chamber: string | null; action: string }[] = []
  const seen = new Set<string>()
  for (const h of bill.history) {
    if (AMENDMENT.test(h.action)) continue
    const kind = MILESTONES.find((m) => m.test.test(h.action))?.kind
    if (!kind) continue
    // One of each kind in each chamber, except the resolving back-and-forth, which is told once.
    const once = kind === "resolving" ? kind : `${kind}:${h.chamber}`
    if (seen.has(once)) continue
    seen.add(once)
    picked.push({ date: String(h.date).slice(0, 10), chamber: h.chamber || null, action: actionText(h.action) })
  }
  const milestones = picked.length > 9 ? [...picked.slice(0, 8), picked[picked.length - 1]] : picked
  const lawLine = [...bill.history].reverse().find((h) => /became (public|private) law|chaptered|chapter \d+/i.test(h.action))?.action ?? null
  const law = lawLine ? (/((public|private) law no:? [\d-]+)/i.exec(lawLine)?.[1] ?? /(chapter \d+)/i.exec(lawLine)?.[1] ?? null) : null
  const lead = bill.sponsors[0]
  const props: BillHistoryProps = {
    citation: (bill as { citation?: string | null }).citation ?? fmtBill(bill.bill_number, bill.state),
    title: bill.title,
    sponsor: lead ? `${lead.name}${lead.party ? ` (${lead.party})` : ""}` : null,
    milestones,
    law,
    source: bill.state === "US" ? "congress.gov" : `${bill.state} legislature`,
  }
  const key = bill.state === "US" ? await one<{ key: string }>(`select key from congress_bills where bill_id = $1`, [billId]) : null
  return { props, keys: { bill_key: key?.key ?? null } }
}
