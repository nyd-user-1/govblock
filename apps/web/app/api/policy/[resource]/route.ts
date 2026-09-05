import { NextResponse } from "next/server"

import { DEFAULT_STATE, readFilters, stateName } from "@/lib/filters"
import { getBillTexts } from "@/lib/policy/texts"
import {
  getActivity,
  getAmendments,
  getBill,
  getBillByNumber,
  getBillVotes,
  getBills,
  getBillText,
  getCommittee,
  getCommitteeBills,
  getCommitteeRoster,
  getCommittees,
  getRollCall,
  getHearingDays,
  getHearings,
  getRecentHearings,
  getMember,
  getMemberRecord,
  getMembers,
  getNewsroom,
  getOptions,
  getPartySeats,
  getRecentTexts,
  getRollCalls,
  getSessions,
  getSessionsWithTitles,
  getStates,
  getStream,
  getSubjects,
  bioguideOf,
  getCommunications,
  getCosponsors,
  getCrsReports,
  getFec,
  getHouseVotes,
  getLobbying,
  getMemberVotes,
  getRecordIssues,
  getBillActions,
  getBillCommittees,
  getBillRecord,
  getBillSponsors,
  getBillSubjects,
  getCboEstimates,
  getCommitteeDetail,
  getCommitteeMeetings,
  getCommitteeReports,
  getCongressHearings,
  getLaws,
  getMemberDetail,
  getMemberDirectory,
  getMembersWithPortraits,
  getNominations,
  getRelatedBills,
  getSummaries,
  getTitles,
  getTallies,
  getTextVersions,
  getTopSponsors,
  getTreaties,
  latestHearingDate,
  NY_ONLY,
  resolve,
  searchAll,
  US_ONLY,
} from "@/lib/policy/db-queries"

// Every legislative read the client makes, scoped by ?state= and ?session=.
// Ported from livingston-v3's route of the same name.

export const dynamic = "force-dynamic"

// Half an hour at the edge, stale-while-revalidate behind it. This is what
// makes the switcher cheap: CloudFront caches per URL, so 52 jurisdictions cost
// ~52 Aurora reads per half hour rather than one per visitor.
const CACHE = "public, s-maxage=1800, stale-while-revalidate=86400"

function int(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function today(offsetDays = 0) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

async function dispatch(resource: string, sp: URLSearchParams) {
  const filters = readFilters(sp)
  const state = filters.state || DEFAULT_STATE

  // Some tables are New York's alone and carry no state column. Under any
  // other scope the honest answer names what was asked for rather than handing
  // back New York's rows wearing another state's name.
  if ((NY_ONLY as readonly string[]).includes(resource) && state !== "NY") {
    throw new Error(`${resource} is a New York dataset. Nothing for ${stateName(state)}.`)
  }
  // The congress.gov families hold the 119th and nothing else. Say so rather
  // than hand Congress's rows to a reader who asked about Texas.
  if ((US_ONLY as readonly string[]).includes(resource) && state !== "US") {
    throw new Error(`${resource} is a Congress dataset. Nothing for ${stateName(state)}.`)
  }

  switch (resource) {
    case "search": {
      const f = await resolve(filters)
      const term = (sp.get("q") ?? "").trim()
      // Both extras are opt-in, and only /search asks for them. ?text=1 buys the
      // pass over "BillTexts"; ?all=1 lets bills[] and committees[] carry
      // jurisdictions other than the reader's. The ⌘K menu sends neither: it
      // has to stay metadata-fast, and it still draws every bill and committee
      // under the flag of the scope you are in, which is only true one
      // jurisdiction at a time. Members were already national and the menu
      // renders them from their own state, so they need no gate.
      const text = sp.get("text") === "1"
      const all = sp.get("all") === "1"
      if (term.length < 2)
        return { q: term, state: f.state, session: f.session, bills: [], members: [], committees: [], texts: [] }
      return searchAll(f, term, Math.min(int(sp.get("limit"), 8), 20), { text, all })
    }
    case "states":
      return getStates()
    case "sessions":
      // Titles cost a cold read of "Bills" (15 s for Texas); only the surfaces
      // that actually show one ask for them.
      return sp.get("titles") ? getSessionsWithTitles(state) : getSessions(state)
    case "options":
      return getOptions(await resolve(filters))
    case "subjects":
      return getSubjects(await resolve(filters))
    case "members":
      return getMembers(await resolve(filters))
    case "member": {
      const f = await resolve(filters)
      const id = int(sp.get("id") ?? f.member ?? null, 0)
      if (!id) throw new Error("member id required")
      return getMember(id, f.session)
    }
    case "record": {
      const f = await resolve(filters)
      const id = int(sp.get("id") ?? f.member ?? null, 0)
      if (!id) throw new Error("member id required")
      return getMemberRecord(f, id, int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
    }
    case "sponsors":
      return getTopSponsors(await resolve(filters), int(sp.get("limit"), 8))
    case "seats":
      return getPartySeats(state)
    case "tallies":
      return getTallies(state)
    case "committees":
      return getCommittees(await resolve(filters))
    case "committee": {
      const f = await resolve(filters)
      const name = sp.get("name") ?? f.committee
      if (!name) throw new Error("committee name required")
      return getCommittee(f, name)
    }
    case "bills": {
      const f = await resolve(filters)
      return getBills(f, int(sp.get("limit"), 40), int(sp.get("offset"), 0) || 0)
    }
    // The committee joins the tree needed (2026-09-03): a roster derived from
    // committee votes, and a committee's bills from its referrals.
    case "roster": {
      const f = await resolve(filters)
      const name = sp.get("name") ?? f.committee
      if (!name) throw new Error("committee name required")
      return getCommitteeRoster(f, name)
    }
    case "committee-bills": {
      const f = await resolve(filters)
      const name = sp.get("name") ?? f.committee
      if (!name) throw new Error("committee name required")
      return getCommitteeBills(f, name, int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
    }
    case "rollcall": {
      const id = int(sp.get("id"), 0)
      if (!id) throw new Error("roll call id required")
      return getRollCall(id)
    }
    case "bill": {
      const f = await resolve(filters)
      let id = int(sp.get("id") ?? f.bill ?? null, 0)
      const number = sp.get("number")
      if (!id && number) {
        // Numbers are stored bare and upper — "HB10171", "A07380" — so "hr 1"
        // and "H.R. 1" normalise before the lookup.
        const bare = number.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
        id = Number((await getBillByNumber(f.state, f.session, bare))?.bill_id ?? 0)
        // A supplied number that matches nothing is a miss, never the newest
        // bill: the fallthrough below is only correct when no identifier was
        // given at all. (Found live by the agents lane: HR 1 answered HB10171
        // with a 200.)
        if (!id) throw new Error(`No bill numbered "${number}" in ${stateName(f.state)} ${f.session}.`)
      }
      if (!id) {
        const { rows } = await getBills(f, 1)
        id = rows[0]?.bill_id ?? 0
      }
      if (!id) return null
      return getBill(id)
    }
    case "text": {
      const f = await resolve(filters)
      const id = int(sp.get("id") ?? f.bill ?? null, 0)
      if (!id) throw new Error("bill id required")
      const doc = await getBillText(id, int(sp.get("document"), 0) || undefined)
      // `format=raw` is GitHub's Raw button: the text itself, as text.
      if (sp.get("format") === "raw") return new Response(doc?.text ?? "", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": CACHE } })
      return doc
    }
    case "bill-texts": {
      // The changelog prints a code block per bill, so one request rather than
      // twenty-four. getBillTexts already fans out one statement per bill (the
      // Data API caps a result at 1 MB and a single bill can approach it); the
      // slice here is for the response, which only ever renders a few hundred
      // lines.
      const ids = (sp.get("ids") ?? "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
        .slice(0, 40)
      if (!ids.length) return {}
      const texts = await getBillTexts(ids)
      return Object.fromEntries([...texts].map(([id, text]) => [id, text.slice(0, 20_000)]))
    }
    case "texts":
      return getRecentTexts(await resolve(filters), int(sp.get("limit"), 60))
    case "votes": {
      const f = await resolve(filters)
      const id = int(sp.get("id") ?? f.bill ?? null, 0)
      if (!id) throw new Error("bill id required")
      return getBillVotes(id)
    }
    case "hearings": {
      const f = await resolve(filters)
      return getHearings(
        f.state,
        f.session,
        sp.get("from") ?? today(-30),
        sp.get("to") ?? today(60),
        sp.get("committee") ?? f.committee,
        int(sp.get("limit"), 3000)
      )
    }
    case "hearings-recent": {
      const f = await resolve(filters)
      return getRecentHearings(
        f.state,
        f.session,
        sp.get("from") ?? today(-30),
        sp.get("to") ?? today(60),
        int(sp.get("limit"), 200)
      )
    }
    case "hearing-days": {
      const f = await resolve(filters)
      return getHearingDays(f.state, f.session, sp.get("from") ?? today(-365), sp.get("to") ?? today(365))
    }
    case "latest-hearing": {
      const f = await resolve(filters)
      return { date: await latestHearingDate(f.state, f.session) }
    }
    case "rollcalls":
      return getRollCalls(await resolve(filters), int(sp.get("limit"), 120))
    case "newsroom":
      return getNewsroom(await resolve(filters), int(sp.get("days"), 14))
    case "activity":
      return getActivity(await resolve(filters))
    case "stream": {
      const named = sp.get("states")
      const requested = (named ?? state)
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
      return getStream([...new Set(requested)].slice(0, 6), int(sp.get("limit"), 12))
    }
    /* ---- money, and it is federal (US only) -------------------------------- */
    // Both readers already existed in db-queries.ts and had no way in. Measured
    // before exposing: all 560,789 joinable "LobbyingBills" rows land on a bill
    // whose state is US (federal LDA filings), and all 5,517 "FecTotals" rows on
    // one of 726 US members. So both are US_ONLY, and another jurisdiction is
    // told what it asked for rather than handed Congress's money as its own.
    case "lobbying": {
      const f = await resolve(filters)
      const id = int(sp.get("bill") ?? sp.get("id") ?? f.bill ?? null, 0)
      if (!id) throw new Error("bill id required")
      return getLobbying(id)
    }
    case "fec": {
      const f = await resolve(filters)
      const id = int(sp.get("member") ?? sp.get("id") ?? f.member ?? null, 0)
      if (!id) throw new Error("member id required")
      return getFec(id)
    }
    /* ---- congress.gov families (US only) ---------------------------------- */
    case "text-versions": {
      const f = await resolve(filters)
      const id = int(sp.get("bill") ?? sp.get("id") ?? f.bill ?? null, 0)
      if (!id) throw new Error("bill id required")
      return getTextVersions(id)
    }
    // `bill=` is honoured, not ignored. These three took the parameter and
    // returned the whole family, so a bill page asking for HR 1's amendments got
    // all 7,035 and the fetch succeeded with the wrong rows.
    case "summaries": {
      const id = int(sp.get("bill"), 0)
      if (!id) throw new Error("bill id required")
      return getSummaries(id)
    }
    case "titles": {
      const id = int(sp.get("bill"), 0)
      if (!id) throw new Error("bill id required")
      return getTitles(id)
    }
    case "related-bills": {
      const id = int(sp.get("bill"), 0)
      if (!id) throw new Error("bill id required")
      return getRelatedBills(id)
    }
    case "cosponsors": {
      const id = int(sp.get("bill"), 0)
      if (!id) throw new Error("bill id required")
      return getCosponsors(id)
    }
    // The depth congress.gov shows. `bill-subjects` and `bill-sponsors` carry
    // the prefix because `subjects` and `sponsors` already mean the
    // jurisdiction's own, for all 52 of them.
    case "actions": {
      const id = int(sp.get("bill"), 0)
      if (!id) throw new Error("bill id required")
      return getBillActions(id, int(sp.get("limit"), 250), int(sp.get("offset"), 0) || 0)
    }
    case "bill-record": {
      const id = int(sp.get("bill"), 0)
      if (!id) throw new Error("bill id required")
      return getBillRecord(id)
    }
    case "bill-sponsors": {
      const id = int(sp.get("bill"), 0)
      if (!id) throw new Error("bill id required")
      return getBillSponsors(id)
    }
    case "bill-committees": {
      const id = int(sp.get("bill"), 0)
      if (!id) throw new Error("bill id required")
      return getBillCommittees(id)
    }
    case "bill-subjects": {
      const id = int(sp.get("bill"), 0)
      if (!id) throw new Error("bill id required")
      return getBillSubjects(id)
    }
    case "cbo-estimates": {
      const id = int(sp.get("bill"), 0)
      if (!id) throw new Error("bill id required")
      return getCboEstimates(id)
    }
    case "house-votes":
      return getHouseVotes(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0, int(sp.get("bill"), 0) || undefined)
    case "member-votes":
      return getMemberVotes({ vote: sp.get("vote") ?? undefined, member: int(sp.get("member"), 0) || undefined, limit: int(sp.get("limit"), 500) })
    case "crs-reports":
      return getCrsReports(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
    case "record-issues":
      return getRecordIssues(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
    case "communications":
      return getCommunications(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0, sp.get("chamber") ?? undefined)
    case "amendments":
      return getAmendments(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0, int(sp.get("bill"), 0) || undefined)
    case "committee-reports":
      return getCommitteeReports(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0, int(sp.get("bill"), 0) || undefined)
    case "laws":
      return getLaws(int(sp.get("limit"), 250), int(sp.get("offset"), 0) || 0, int(sp.get("bill"), 0) || undefined)
    case "nominations":
      return getNominations(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
    case "committee-meetings":
      return getCommitteeMeetings(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
    case "hearings-congress":
      return getCongressHearings(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
    case "treaties":
      return getTreaties(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
    case "member-detail": {
      // Pages hold our people_id, not the bioguide the congress.gov tables are
      // keyed on; translate rather than making every caller do it.
      const peopleId = int(sp.get("member"), 0)
      const id = peopleId ? await bioguideOf(peopleId) : (sp.get("bioguide") ?? sp.get("id"))
      if (peopleId && !id) return { member: null, people_id: peopleId, detail: "no bioguide on file for that member" }
      if (!id) return { members: await getMembersWithPortraits(int(sp.get("limit"), 600)) }
      return getMemberDetail(id)
    }
    case "member-directory": {
      // A House member's offices and staff from the House Telephone Directory,
      // or a senator's contact record from senate.gov. Keyed by our people_id.
      const peopleId = int(sp.get("member"), 0)
      if (!peopleId) throw new Error("member required")
      return (await getMemberDirectory(peopleId)) ?? { chamber: null, senate: null, offices: [], staff: [] }
    }
    case "committee-detail": {
      const code = sp.get("systemCode") ?? sp.get("code")
      if (!code) throw new Error("systemCode required")
      return getCommitteeDetail(code)
    }
    default:
      return undefined
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params
  const sp = new URL(request.url).searchParams
  try {
    const data = await dispatch(resource, sp)
    if (data instanceof Response) return data
    if (data === undefined) {
      return NextResponse.json({ error: `unknown resource ${resource}` }, { status: 404 })
    }
    return NextResponse.json(data, { headers: { "cache-control": CACHE } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`policy/${resource} failed`, message)
    // 503, not 500: the caller decides whether to stand in a snapshot, and it
    // may only do so for Congress (§0.2 — never one jurisdiction's rows under
    // another's name).
    return NextResponse.json({ error: message, resource }, { status: 503 })
  }
}
