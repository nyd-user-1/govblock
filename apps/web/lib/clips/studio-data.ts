import "server-only"

import type { StudioData } from "@/components/clips/studio/spec"
import { resolveLink } from "@/components/clips/studio/spec"
import { billHistoryProps, rollCallTallyProps } from "@/lib/clips/templates"

// What a pasted link gives a Studio template (2026-09-14): named values for
// {field} slots and the lists a timeline or bar scene reads. Built on the same
// reads the built-in templates use.

const PARTY: Record<string, string> = { R: "Republicans", D: "Democrats", I: "Independents", ID: "Independents" }
const day = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "")

export async function studioData(link: string): Promise<{ data: StudioData; keys: { bill_key: string | null; roll_call_chamber?: string; roll_call_key?: string | null } } | null> {
  const target = resolveLink(link)
  if (!target) return null
  if (target.kind === "roll-call") {
    const found = await rollCallTallyProps({ chamber: target.chamber, congress: target.congress, session: target.session, roll: target.roll })
    if (!found) return null
    const p = found.props
    return {
      data: {
        kind: "roll-call",
        link: `${p.chamber}-${p.congress}-${p.session}/${p.roll}`,
        fields: {
          chamber: p.chamber === "senate" ? "Senate" : "House",
          roll: String(p.roll),
          congress: String(p.congress),
          session: String(p.session),
          date: day(p.date),
          citation: p.citation ?? `${p.chamber === "senate" ? "Senate" : "House"} roll call ${p.roll}`,
          title: p.billTitle ?? "",
          question: p.question ?? "",
          result: p.result ?? "",
          yea: String(p.counts.yea),
          nay: String(p.counts.nay),
          present: String(p.counts.present),
          notVoting: String(p.counts.notVoting),
          source: p.chamber === "senate" ? "senate.gov" : "clerk.house.gov via congress.gov",
        },
        lists: { parties: p.parties.map((r) => ({ label: PARTY[r.party] ?? r.party, yes: r.yea, no: r.nay })) },
      },
      keys: found.keys,
    }
  }
  const found = await billHistoryProps(target.billId)
  if (!found) return null
  const p = found.props
  const first = p.milestones[0]
  const last = p.milestones[p.milestones.length - 1]
  return {
    data: {
      kind: "bill",
      link: `/bills/${target.billId}`,
      fields: {
        citation: p.citation,
        title: p.title,
        sponsor: p.sponsor ?? "",
        law: p.law ?? "",
        chamber: first?.chamber ?? "",
        introduced: day(first?.date),
        latestAction: last?.action ?? "",
        latestDate: day(last?.date),
        source: p.source,
      },
      lists: { milestones: p.milestones },
    },
    keys: found.keys,
  }
}
