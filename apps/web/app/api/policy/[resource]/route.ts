import { NextResponse } from "next/server"

import { DEFAULT_STATE, readFilters, stateName } from "@/lib/filters"
import { getBillTexts } from "@/lib/policy/texts"
import { findCongressCommittee, getCommitteeBillsByStatus, getCommitteeCommunicationRows, getCommitteeNominationRows, getCommitteeRail, getCommitteeRoster as getCongressCommitteeRoster, getCongressHearingList, getHearingIndex, getHearingTranscript, getMemberRail, getMemberVoteRecord, getNominationList, getRecordArticles } from "@/lib/policy/committee-queries"
import { resolveCommittee } from "@/lib/policy/committee-resolve"
import { departmentsOf, findDepartment } from "@/lib/data/departments"
import { getBillsByParty, getMetric, type MetricKey } from "@/lib/policy/metrics"
import { getDepartmentBillCounts, getDepartmentBills, getDepartmentForms, getDepartmentNominations } from "@/lib/policy/department-queries"
import {
  getActivity,
  getAmendments,
  getBill,
  getBillByNumber,
  getBillAmendments,
  getBillSponsorship,
  getBillStatus,
  getBillVotes,
  getBills,
  getCalendar,
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
  getMemberState,
  latestSession,
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
  getSubjectTerms,
  getAdoptedBySession,
  getProvenance,
  bioguideOf,
  getCommunications,
  getCongressOnlyBill,
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
  getUsBill,
  latestHearingDate,
  NY_ONLY,
  resolve,
  type Resolved,
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

// The departments index counts 117 name patterns against the session's bills; once an hour is plenty.
const departmentCountCache = new Map<string, { at: number; value: unknown }>()

function int(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function today(offsetDays = 0) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

/**
 * The bill a request is about, by id or by the number someone typed.
 *
 * The cases below are read by tools rather than by pages, and a tool is given
 * whatever the reader wrote — "H.R. 155" as often as an id. Pages keep passing
 * ids and never reach the second half of this.
 */
async function billFrom(f: Resolved, sp: URLSearchParams) {
  const id = int(sp.get("bill") ?? sp.get("id") ?? f.bill ?? null, 0)
  if (id) return id
  const number = sp.get("number")
  if (!number) throw new Error("bill id or number required")
  if (f.state === "US") {
    const found = await getUsBill(f.session, number)
    if (found?.bill_id) return found.bill_id
    throw new Error(found ? `congress.gov holds ${number} but the record's fuller mirror does not yet, so there is nothing further to read on it.` : `No bill numbered "${number}" in ${stateName(f.state)} ${f.session}.`)
  }
  const bare = await getBillByNumber(f.state, f.session, number.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
  if (!bare) throw new Error(`No bill numbered "${number}" in ${stateName(f.state)} ${f.session}.`)
  return Number(bare.bill_id)
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
      if (term.length < 2) return { q: term, state: f.state, session: f.session, bills: [], members: [], committees: [], texts: [] }
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
      return getPartySeats(await resolve(filters))
    // Bills adopted per session, every session the jurisdiction has.
    case "adopted":
      return getAdoptedBySession(state)
    // The whole record and how it fills: for the Admin experience's Database page.
    case "provenance":
      return getProvenance()
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
      // `sort=number-desc` is congress.gov's document-number order; the
      // default is the newest action first, as every list on the site reads.
      const sort = sp.get("sort")
      return getBills(f, int(sp.get("limit"), 40), int(sp.get("offset"), 0) || 0, sort === "number-desc" || sort === "number-asc" ? sort : "newest")
    }
    // Every subject term of the jurisdiction with its bill count: CRS's policy
    // areas and legislative subjects under Congress, LegiScan's elsewhere.
    // `subjects` keeps its old answer, the top eighty by count.
    case "subject-terms": {
      const f = await resolve(filters)
      return getSubjectTerms(f)
    }
    // The committee joins the tree needed (2026-09-03): a roster derived from
    // committee votes, and a committee's bills from its referrals.
    case "roster": {
      const f = await resolve(filters)
      const name = sp.get("name") ?? f.committee
      if (!name) throw new Error("committee name required")
      // Congress publishes its rosters, so under US the answer is the published
      // one — with the chair and the ranking member named as such. Everywhere
      // else the roster is derived from who voted, because nothing in the
      // source publishes one (see getCommitteeRoster in db-queries).
      if (f.state === "US") {
        const found = await findCongressCommittee(name)
        if (!found) throw new Error(`No committee matching "${name}" in Congress. list_committees gives the names.`)
        return { committee: found.name, code: found.code, chamber: found.chamber, source: "congress.gov", members: await getCongressCommitteeRoster(found.code) }
      }
      return getCommitteeRoster(f, name)
    }
    case "committee-bills": {
      const f = await resolve(filters)
      const name = sp.get("name") ?? f.committee
      if (!name) throw new Error("committee name required")
      // The committee page's tabs page one status at a time.
      const status = sp.get("status")
      if (status) return getCommitteeBillsByStatus(f, name, status, int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
      return getCommitteeBills(f, name, int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
    }
    case "hearing-index":
      return getHearingIndex(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0, sp.get("chamber") ?? undefined)
    case "metric": {
      // A home page tile: one count by day over a window, with the window before it.
      const f = await resolve(filters)
      const key = sp.get("metric") as MetricKey | null
      if (!key) throw new Error("metric required")
      const days = Math.min(Math.max(int(sp.get("days"), 30), 1), 366)
      const answer = await getMetric(f, key, days)
      if (!answer) throw new Error(`no such metric: ${key}`)
      return answer
    }
    case "bills-by-party": {
      const f = await resolve(filters)
      return { rows: await getBillsByParty(f, Math.min(Math.max(int(sp.get("months"), 6), 1), 24)) }
    }
    case "departments": {
      // The index's bill counts: how many of the session's bills name each department. An hour's cache per jurisdiction.
      const f = await resolve(filters)
      const cached = departmentCountCache.get(`${f.state}:${f.session}`)
      if (cached && Date.now() - cached.at < 3_600_000) return cached.value
      const counts = Object.fromEntries(await getDepartmentBillCounts(f, departmentsOf(f.state)))
      const value = { state: f.state, session: f.session, counts }
      departmentCountCache.set(`${f.state}:${f.session}`, { at: Date.now(), value })
      return value
    }
    case "department-bills": {
      const f = await resolve(filters)
      const department = findDepartment(sp.get("slug") ?? "")
      if (!department) throw new Error("no such department")
      return getDepartmentBills({ state: department.state, session: f.state === department.state ? f.session : await latestSession(department.state) }, department, int(sp.get("limit"), 25), int(sp.get("offset"), 0) || 0)
    }
    case "department-nominations": {
      const department = findDepartment(sp.get("slug") ?? "")
      if (!department) throw new Error("no such department")
      return getDepartmentNominations(department, int(sp.get("limit"), 25), int(sp.get("offset"), 0) || 0)
    }
    case "department-forms": {
      const department = findDepartment(sp.get("slug") ?? "")
      if (!department || !department.forms.length) throw new Error("no such department")
      return getDepartmentForms(department, int(sp.get("limit"), 25), int(sp.get("offset"), 0) || 0)
    }
    case "vote-record": {
      // A member's every recorded position, for the PDF (Brendan, 2026-09-06).
      const member = int(sp.get("member"), 0)
      if (!member) throw new Error("member required")
      const memberState = await getMemberState(member)
      if (!memberState) throw new Error("no such member")
      return { member, state: memberState, rows: await getMemberVoteRecord(member, memberState) }
    }
    case "rail": {
      // What the left rail shows beside a committee or a member: their own
      // bills above the jurisdiction's recent ones (Brendan, 2026-09-06).
      const committeeId = sp.get("committee")
      const member = int(sp.get("member"), 0)
      if (committeeId) {
        const committee = await resolveCommittee(committeeId)
        if (!committee) throw new Error("no such committee")
        const session = int(sp.get("session"), 0) || (await latestSession(committee.state))
        return { label: committee.legiscanName, state: committee.state, session, ...(await getCommitteeRail({ state: committee.state, session }, committee.legiscanName)) }
      }
      if (member) {
        const memberState = await getMemberState(member)
        if (!memberState) throw new Error("no such member")
        const session = int(sp.get("session"), 0) || (await latestSession(memberState))
        return { state: memberState, session, ...(await getMemberRail({ state: memberState, session }, member)) }
      }
      throw new Error("committee or member required")
    }
    case "committee-nominations": {
      const code = sp.get("committee") ?? sp.get("code")
      if (!code) throw new Error("committee code required")
      return getCommitteeNominationRows(code, int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
    }
    case "committee-communications": {
      const code = sp.get("committee") ?? sp.get("code")
      if (!code) throw new Error("committee code required")
      return getCommitteeCommunicationRows(code, int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
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
        if (f.state === "US") {
          // Congress is cited the way congress.gov writes it, and the two
          // schemes collide: "H.R. 155" stripped of its punctuation is
          // LegiScan's HR155, a different bill. getUsBill reads the citation
          // before the punctuation is gone — see the block above it in
          // db-queries.
          const found = await getUsBill(f.session, number)
          if (!found) throw new Error(`No bill numbered "${number}" in ${stateName(f.state)} ${f.session}.`)
          // congress.gov holds it and the mirror does not yet: answer from
          // congress.gov rather than deny a bill that exists.
          if (!found.bill_id && found.key) return getCongressOnlyBill(found.key)
          id = found.bill_id ?? 0
        } else {
          // Numbers are stored bare and upper — "A07380" — so "a 7380" and
          // "A. 7380" normalise before the lookup.
          const bare = number.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
          id = Number((await getBillByNumber(f.state, f.session, bare))?.bill_id ?? 0)
        }
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
      // `chars` asks for a window rather than the document: the longest bills
      // here are six million characters and the Data API refuses a result over
      // 1 MB, so a caller that only needs to read some of it says so and gets
      // `full_chars` back to page through the rest with `from`.
      const chars = int(sp.get("chars"), 0)
      const doc = await getBillText(id, int(sp.get("document"), 0) || undefined, chars ? { chars: Math.min(chars, 200_000), from: int(sp.get("from"), 0) || 0 } : undefined)
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
    // The three the agents ask of one bill. Each takes `bill=` as an id or
    // `number=` as a citation, and answers from whichever family holds the
    // fuller record for that jurisdiction.
    case "bill-sponsorship": {
      const f = await resolve(filters)
      return getBillSponsorship(await billFrom(f, sp), f.state)
    }
    case "bill-status": {
      const f = await resolve(filters)
      const answer = await getBillStatus(await billFrom(f, sp), int(sp.get("limit"), 40))
      if (!answer) throw new Error("no such bill")
      return answer
    }
    case "bill-amendments": {
      const f = await resolve(filters)
      if (f.state !== "US") throw new Error(`Amendments are a Congress dataset. This record holds none for ${stateName(f.state)}.`)
      return getBillAmendments(await billFrom(f, sp), int(sp.get("limit"), 25))
    }
    case "hearings": {
      const f = await resolve(filters)
      return getHearings(f.state, f.session, sp.get("from") ?? today(-30), sp.get("to") ?? today(60), sp.get("committee") ?? f.committee, int(sp.get("limit"), 3000))
    }
    // What is scheduled, in a window: LegiScan's "Calendar" for all 52 with the
    // bill on each row, and under Congress the committee meetings congress.gov
    // publishes beside it. The default window runs from today so the answer is
    // "what is coming" rather than "what happened"; pass `from` to look back.
    case "calendar": {
      const f = await resolve(filters)
      return getCalendar(f, {
        from: sp.get("from") ?? today(),
        to: sp.get("to") ?? today(45),
        committee: sp.get("committee") ?? f.committee,
        bill: int(sp.get("bill"), 0) || null,
        limit: int(sp.get("limit"), 40),
      })
    }
    // The hearings congress.gov has published, with whether we hold the
    // transcript. Its sibling `hearings` is the state calendar's, which is a
    // different thing: a sitting that was scheduled, not a volume that was
    // printed.
    case "hearings-held": {
      const committee = sp.get("committee")
      const found = committee ? await findCongressCommittee(committee) : null
      if (committee && !found) throw new Error(`No committee matching "${committee}" in Congress. list_committees gives the names.`)
      return { committee: found?.name ?? null, ...(await getCongressHearingList({ committee: found?.code, from: sp.get("from"), to: sp.get("to"), q: sp.get("q"), limit: int(sp.get("limit"), 25) })) }
    }
    // A hearing's transcript, or the Congressional Record's citations. The two
    // sit under one resource because they answer the same question — what was
    // said — and differ only in whether we hold the words.
    case "transcript": {
      const hearing = sp.get("hearing") ?? sp.get("id")
      const term = sp.get("q")
      if (hearing) {
        const doc = await getHearingTranscript(hearing, { chars: int(sp.get("chars"), 6000), from: int(sp.get("from"), 0) || 0, q: term })
        if (!doc) throw new Error(`No transcript on file for hearing "${hearing}". hearings gives the jacket numbers, and has_text says which have one.`)
        return doc
      }
      if (!term) throw new Error("a hearing jacket number or a search term is required")
      return getRecordArticles({ q: term, limit: int(sp.get("limit"), 15) })
    }
    case "hearings-recent": {
      const f = await resolve(filters)
      return getRecentHearings(f.state, f.session, sp.get("from") ?? today(-30), sp.get("to") ?? today(60), int(sp.get("limit"), 200))
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
    case "house-votes": {
      // `bill=` may be a number as well as an id, so a tool can ask for
      // "H.R. 1's votes" without a round trip through get_bill first.
      const f = await resolve(filters)
      const bill = sp.get("bill") || sp.get("id") || sp.get("number") ? await billFrom(f, sp).catch(() => 0) : 0
      return getHouseVotes(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0, bill || undefined, sp.get("from"), sp.get("to"))
    }
    case "member-votes":
      return getMemberVotes({ vote: sp.get("vote") ?? undefined, member: int(sp.get("member"), 0) || undefined, limit: int(sp.get("limit"), 500), offset: int(sp.get("offset"), 0) || 0 })
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
    case "nominations": {
      // The family list when nothing is asked of it, so the pages that page
      // through it are unchanged; filtered when a question is.
      const committee = sp.get("committee")
      const term = sp.get("q")
      if (!committee && !term && !sp.get("congress")) return getNominations(int(sp.get("limit"), 50), int(sp.get("offset"), 0) || 0)
      const found = committee ? await findCongressCommittee(committee) : null
      if (committee && !found) throw new Error(`No committee matching "${committee}" in Congress.`)
      return getNominationList({
        committee: found?.code ?? committee,
        q: term,
        congress: int(sp.get("congress"), 119),
        limit: int(sp.get("limit"), 20),
        offset: int(sp.get("offset"), 0) || 0,
      })
    }
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
